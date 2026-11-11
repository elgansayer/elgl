import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LocalTrackPublication,
  RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  TrackEvent,
} from 'livekit-client';
import { CallAudioSessionService } from './call-audio-session.service';
import { LoggingService } from './logging.service';

type Listener = (...args: unknown[]) => void;

/** The slice of LocalTrack the service uses, with a real event surface. */
class FakeMicrophoneTrack {
  isMuted = false;
  readonly restartTrack = vi.fn().mockResolvedValue(undefined);
  readonly unmute = vi.fn(async () => {
    this.isMuted = false;
  });
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): this {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }

  off(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      listener();
    }
  }

  listenerCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }
}

function fakeRemoteAudio(kind: string = Track.Kind.Audio) {
  const element = document.createElement('audio');
  const play = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(element, 'play', { value: play, configurable: true });
  const track = {
    kind,
    attach: vi.fn(() => element),
    detach: vi.fn(() => [element]),
  };
  return { track: track as unknown as RemoteTrack, element, play, spy: track };
}

function publication(source: Track.Source, track: FakeMicrophoneTrack): LocalTrackPublication {
  return { source, track } as unknown as LocalTrackPublication;
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function device(deviceId: string, label: string, kind: MediaDeviceKind): MediaDeviceInfo {
  return { deviceId, label, kind, groupId: `group-${deviceId}` } as MediaDeviceInfo;
}

describe('CallAudioSessionService', () => {
  let service: CallAudioSessionService;
  let room: Room;
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: LoggingService, useValue: logger }],
    });
    service = TestBed.inject(CallAudioSessionService);
    room = new Room();
  });

  afterEach(() => {
    service.detach(room);
    setVisibility('visible');
    vi.restoreAllMocks();
  });

  function usePublishedMicrophone(): FakeMicrophoneTrack {
    const mic = new FakeMicrophoneTrack();
    vi.spyOn(room.localParticipant, 'getTrackPublication').mockImplementation((source) =>
      source === Track.Source.Microphone ? publication(source, mic) : undefined,
    );
    return mic;
  }

  describe('session lifecycle', () => {
    it('is inactive until a room is attached', () => {
      expect(service.isActive()).toBe(false);
      expect(service.isCallActive()).toBe(false);
    });

    it('reports a call session as active for the app lock', () => {
      service.attach(room, 'call');

      expect(service.isActive()).toBe(true);
      expect(service.isCallActive()).toBe(true);
    });

    it('does not report a room session as a call', () => {
      service.attach(room, 'room');

      expect(service.isActive()).toBe(true);
      expect(service.isCallActive()).toBe(false);
    });

    it('releases the session when the attached room detaches', () => {
      service.attach(room, 'call');

      service.detach(room);

      expect(service.isActive()).toBe(false);
    });

    it('ignores a detach from a room that is not the attached one', () => {
      service.attach(room, 'call');

      service.detach(new Room());

      expect(service.isActive()).toBe(true);
    });

    it('is idempotent when the same room is attached twice', () => {
      const subscribed = fakeRemoteAudio();
      service.attach(room, 'call');
      service.attach(room, 'call');

      room.emit(RoomEvent.TrackSubscribed, subscribed.track, {} as never, {} as never);

      expect(subscribed.spy.attach).toHaveBeenCalledTimes(1);
    });

    it('releases the previous room when a different room is attached', () => {
      const other = new Room();
      const first = fakeRemoteAudio();
      service.attach(room, 'call');

      service.attach(other, 'room');
      room.emit(RoomEvent.TrackSubscribed, first.track, {} as never, {} as never);

      expect(first.spy.attach).not.toHaveBeenCalled();
      expect(service.isCallActive()).toBe(false);
      service.detach(other);
    });

    it('releases the session when the room disconnects without its owner noticing', () => {
      service.attach(room, 'call');

      room.emit(RoomEvent.Disconnected);

      expect(service.isActive()).toBe(false);
    });

    it('clears every notice when the session ends', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');
      mic.emit(TrackEvent.UpstreamPaused);
      room.emit(RoomEvent.AudioPlaybackStatusChanged, false);

      service.detach(room);

      expect(service.microphoneInterrupted()).toBe(false);
      expect(service.playbackBlocked()).toBe(false);
      expect(service.deviceNotice()).toBeNull();
    });
  });

  describe('remote audio rendering', () => {
    it('plays a subscribed audio track through a hidden element in the document', () => {
      const { track, element, spy } = fakeRemoteAudio();
      service.attach(room, 'call');

      room.emit(RoomEvent.TrackSubscribed, track, {} as never, {} as never);

      expect(spy.attach).toHaveBeenCalledTimes(1);
      const sink = document.querySelector('[data-call-audio-sink]');
      expect(sink).not.toBeNull();
      expect(sink?.hasAttribute('hidden')).toBe(true);
      expect(sink?.contains(element)).toBe(true);
    });

    it('ignores subscribed video tracks', () => {
      const { track, spy } = fakeRemoteAudio(Track.Kind.Video);
      service.attach(room, 'call');

      room.emit(RoomEvent.TrackSubscribed, track, {} as never, {} as never);

      expect(spy.attach).not.toHaveBeenCalled();
    });

    it('plays audio tracks that were subscribed before the room was attached', () => {
      const { track, spy } = fakeRemoteAudio();
      room.remoteParticipants.set('remote-1', {
        audioTrackPublications: new Map([['track-1', { track }]]),
      } as unknown as RemoteParticipant);

      service.attach(room, 'call');

      expect(spy.attach).toHaveBeenCalledTimes(1);
    });

    it('removes the element when the track is unsubscribed', () => {
      const { track, element, spy } = fakeRemoteAudio();
      service.attach(room, 'call');
      room.emit(RoomEvent.TrackSubscribed, track, {} as never, {} as never);

      room.emit(RoomEvent.TrackUnsubscribed, track, {} as never, {} as never);

      expect(spy.detach).toHaveBeenCalledTimes(1);
      expect(document.body.contains(element)).toBe(false);
    });

    it('removes the sink and every element when the session ends', () => {
      const { track, element } = fakeRemoteAudio();
      service.attach(room, 'call');
      room.emit(RoomEvent.TrackSubscribed, track, {} as never, {} as never);

      service.detach(room);

      expect(document.querySelector('[data-call-audio-sink]')).toBeNull();
      expect(document.body.contains(element)).toBe(false);
    });

    it('starts playback again when a headset key or interruption pauses the element', () => {
      const { track, element, play } = fakeRemoteAudio();
      service.attach(room, 'call');
      room.emit(RoomEvent.TrackSubscribed, track, {} as never, {} as never);

      element.dispatchEvent(new Event('pause'));

      expect(play).toHaveBeenCalledTimes(1);
    });

    it('reports blocked playback when the browser refuses to resume a paused element', async () => {
      const { track, element, play } = fakeRemoteAudio();
      play.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
      service.attach(room, 'call');
      room.emit(RoomEvent.TrackSubscribed, track, {} as never, {} as never);

      element.dispatchEvent(new Event('pause'));

      await vi.waitFor(() => expect(service.playbackBlocked()).toBe(true));
    });

    it('does not report blocked playback for other resume failures', async () => {
      const { track, element, play } = fakeRemoteAudio();
      play.mockRejectedValue(new DOMException('replaced', 'AbortError'));
      service.attach(room, 'call');
      room.emit(RoomEvent.TrackSubscribed, track, {} as never, {} as never);

      element.dispatchEvent(new Event('pause'));
      await Promise.resolve();
      await Promise.resolve();

      expect(service.playbackBlocked()).toBe(false);
    });

    it('does not restart an element that the session already released', () => {
      const { track, element, play } = fakeRemoteAudio();
      service.attach(room, 'call');
      room.emit(RoomEvent.TrackSubscribed, track, {} as never, {} as never);
      room.emit(RoomEvent.TrackUnsubscribed, track, {} as never, {} as never);

      element.dispatchEvent(new Event('pause'));

      expect(play).not.toHaveBeenCalled();
    });
  });

  describe('blocked playback', () => {
    it('follows the room playback status', () => {
      service.attach(room, 'call');

      room.emit(RoomEvent.AudioPlaybackStatusChanged, false);
      expect(service.playbackBlocked()).toBe(true);

      room.emit(RoomEvent.AudioPlaybackStatusChanged, true);
      expect(service.playbackBlocked()).toBe(false);
    });

    it('starts blocked when the room cannot play audio on attach', () => {
      vi.spyOn(room, 'canPlaybackAudio', 'get').mockReturnValue(false);

      service.attach(room, 'call');

      expect(service.playbackBlocked()).toBe(true);
    });

    it('resumes playback from a user gesture and clears the block', async () => {
      const startAudio = vi.spyOn(room, 'startAudio').mockResolvedValue(undefined);
      service.attach(room, 'call');
      room.emit(RoomEvent.AudioPlaybackStatusChanged, false);

      await expect(service.resumePlayback()).resolves.toBe(true);

      expect(startAudio).toHaveBeenCalledTimes(1);
      expect(service.playbackBlocked()).toBe(false);
    });

    it('stays blocked and reports failure when the browser still refuses', async () => {
      vi.spyOn(room, 'startAudio').mockRejectedValue(new DOMException('no', 'NotAllowedError'));
      service.attach(room, 'call');
      room.emit(RoomEvent.AudioPlaybackStatusChanged, false);

      await expect(service.resumePlayback()).resolves.toBe(false);

      expect(service.playbackBlocked()).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('playback-resume-rejected', 'CallAudioSession', {
        reason: 'NotAllowedError',
      });
    });

    it('cannot resume without a session', async () => {
      await expect(service.resumePlayback()).resolves.toBe(false);
    });

    it('retries playback when the page returns to the foreground while blocked', () => {
      const startAudio = vi.spyOn(room, 'startAudio').mockResolvedValue(undefined);
      service.attach(room, 'call');
      room.emit(RoomEvent.AudioPlaybackStatusChanged, false);

      setVisibility('visible');

      expect(startAudio).toHaveBeenCalledTimes(1);
    });

    it('retries playback when an element was paused while the page was hidden', () => {
      const startAudio = vi.spyOn(room, 'startAudio').mockResolvedValue(undefined);
      const { track } = fakeRemoteAudio();
      service.attach(room, 'call');
      room.emit(RoomEvent.TrackSubscribed, track, {} as never, {} as never);

      setVisibility('visible');

      expect(startAudio).toHaveBeenCalledTimes(1);
    });

    it('leaves playback alone when the page goes to the background', () => {
      const startAudio = vi.spyOn(room, 'startAudio').mockResolvedValue(undefined);
      service.attach(room, 'call');
      room.emit(RoomEvent.AudioPlaybackStatusChanged, false);

      setVisibility('hidden');

      expect(startAudio).not.toHaveBeenCalled();
    });

    it('leaves playback alone on return when nothing stalled', () => {
      const startAudio = vi.spyOn(room, 'startAudio').mockResolvedValue(undefined);
      service.attach(room, 'call');

      setVisibility('visible');

      expect(startAudio).not.toHaveBeenCalled();
    });

    it('stops listening for visibility changes once the session ends', () => {
      const startAudio = vi.spyOn(room, 'startAudio').mockResolvedValue(undefined);
      service.attach(room, 'call');
      room.emit(RoomEvent.AudioPlaybackStatusChanged, false);
      service.detach(room);

      setVisibility('visible');

      expect(startAudio).not.toHaveBeenCalled();
    });
  });

  describe('microphone interruptions', () => {
    it('is not interrupted by a deliberate mute', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');

      mic.emit(TrackEvent.Muted);

      expect(service.microphoneInterrupted()).toBe(false);
    });

    it('flags a microphone that ended and could not be restarted', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');

      mic.emit(TrackEvent.Ended);
      mic.emit(TrackEvent.Muted);

      expect(service.microphoneInterrupted()).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('microphone-interrupted', 'CallAudioSession', {
        reason: 'ended',
      });
    });

    it('stays quiet when LiveKit restarts an ended microphone', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');

      mic.emit(TrackEvent.Ended);
      mic.emit(TrackEvent.Restarted);
      mic.emit(TrackEvent.Muted);

      expect(service.microphoneInterrupted()).toBe(false);
    });

    it('clears the flag when the microphone is unmuted again', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');
      mic.emit(TrackEvent.Ended);
      mic.emit(TrackEvent.Muted);

      mic.emit(TrackEvent.Unmuted);

      expect(service.microphoneInterrupted()).toBe(false);
    });

    it('flags a microphone the operating system paused and clears it on resume', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');

      mic.emit(TrackEvent.UpstreamPaused);
      expect(service.microphoneInterrupted()).toBe(true);

      mic.emit(TrackEvent.UpstreamResumed);
      expect(service.microphoneInterrupted()).toBe(false);
    });

    it('flags a microphone that delivers only silence', () => {
      service.attach(room, 'call');

      room.emit(RoomEvent.LocalAudioSilenceDetected, {} as LocalTrackPublication);

      expect(service.microphoneInterrupted()).toBe(true);
    });

    it('flags a restarted microphone that delivers only silence', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');

      mic.emit(TrackEvent.Restarted);
      mic.emit(TrackEvent.AudioSilenceDetected);

      expect(service.microphoneInterrupted()).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('microphone-interrupted', 'CallAudioSession', {
        reason: 'silence',
      });
    });

    it('does not treat the silence of a muted microphone as a failure', () => {
      const mic = usePublishedMicrophone();
      mic.isMuted = true;
      service.attach(room, 'call');

      mic.emit(TrackEvent.AudioSilenceDetected);

      expect(service.microphoneInterrupted()).toBe(false);
    });

    it('logs one failure once even when the room and the track both report it', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');

      room.emit(RoomEvent.LocalAudioSilenceDetected, {} as LocalTrackPublication);
      mic.emit(TrackEvent.AudioSilenceDetected);

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('flags a microphone that could not be opened', () => {
      service.attach(room, 'call');

      room.emit(
        RoomEvent.MediaDevicesError,
        new DOMException('busy', 'NotReadableError'),
        'audioinput',
      );

      expect(service.microphoneInterrupted()).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('microphone-interrupted', 'CallAudioSession', {
        reason: 'device-error',
        failure: 'NotReadableError',
      });
    });

    it('ignores camera errors', () => {
      service.attach(room, 'call');

      room.emit(
        RoomEvent.MediaDevicesError,
        new DOMException('busy', 'NotReadableError'),
        'videoinput',
      );

      expect(service.microphoneInterrupted()).toBe(false);
    });

    it('watches a microphone published after the room was attached', () => {
      service.attach(room, 'call');
      const mic = new FakeMicrophoneTrack();

      room.emit(
        RoomEvent.LocalTrackPublished,
        publication(Track.Source.Microphone, mic),
        room.localParticipant,
      );
      mic.emit(TrackEvent.UpstreamPaused);

      expect(service.microphoneInterrupted()).toBe(true);
    });

    it('does not watch a camera that was published', () => {
      service.attach(room, 'call');
      const camera = new FakeMicrophoneTrack();

      room.emit(
        RoomEvent.LocalTrackPublished,
        publication(Track.Source.Camera, camera),
        room.localParticipant,
      );

      expect(camera.listenerCount()).toBe(0);
    });

    it('stops watching and clears the flag when the microphone is unpublished', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');
      mic.emit(TrackEvent.UpstreamPaused);

      room.emit(
        RoomEvent.LocalTrackUnpublished,
        publication(Track.Source.Microphone, mic),
        room.localParticipant,
      );

      expect(service.microphoneInterrupted()).toBe(false);
      expect(mic.listenerCount()).toBe(0);
    });

    it('releases every microphone listener when the session ends', () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');
      expect(mic.listenerCount()).toBeGreaterThan(0);

      service.detach(room);

      expect(mic.listenerCount()).toBe(0);
    });

    it('lets the person dismiss the notice', () => {
      service.attach(room, 'call');
      room.emit(RoomEvent.LocalAudioSilenceDetected, {} as LocalTrackPublication);

      service.dismissMicrophoneNotice();

      expect(service.microphoneInterrupted()).toBe(false);
    });
  });

  describe('microphone recovery', () => {
    it('restarts the microphone on the default device, not the one that just disappeared', async () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');
      mic.emit(TrackEvent.UpstreamPaused);

      await expect(service.recoverMicrophone()).resolves.toBe(true);

      expect(mic.restartTrack).toHaveBeenCalledWith({ deviceId: 'default' });
      expect(service.microphoneInterrupted()).toBe(false);
    });

    it('unmutes a microphone that LiveKit muted after giving up', async () => {
      const mic = usePublishedMicrophone();
      mic.isMuted = true;
      service.attach(room, 'call');

      await service.recoverMicrophone();

      expect(mic.unmute).toHaveBeenCalledTimes(1);
    });

    it('does not unmute a microphone that is already live', async () => {
      const mic = usePublishedMicrophone();
      service.attach(room, 'call');

      await service.recoverMicrophone();

      expect(mic.unmute).not.toHaveBeenCalled();
    });

    it('publishes a microphone again when none is published', async () => {
      const setMicrophoneEnabled = vi
        .spyOn(room.localParticipant, 'setMicrophoneEnabled')
        .mockResolvedValue(undefined);
      service.attach(room, 'call');
      room.emit(
        RoomEvent.MediaDevicesError,
        new DOMException('gone', 'NotFoundError'),
        'audioinput',
      );

      await expect(service.recoverMicrophone()).resolves.toBe(true);

      expect(setMicrophoneEnabled).toHaveBeenCalledWith(true);
      expect(service.microphoneInterrupted()).toBe(false);
    });

    it('keeps the notice and reports the failure when the microphone cannot be re-acquired', async () => {
      const mic = usePublishedMicrophone();
      mic.restartTrack.mockRejectedValue(new DOMException('none', 'NotFoundError'));
      service.attach(room, 'call');
      mic.emit(TrackEvent.UpstreamPaused);

      await expect(service.recoverMicrophone()).resolves.toBe(false);

      expect(service.microphoneInterrupted()).toBe(true);
      expect(logger.error).toHaveBeenCalledWith('microphone-recovery-failed', 'CallAudioSession', {
        reason: 'NotFoundError',
      });
    });

    it('cannot recover without a session', async () => {
      await expect(service.recoverMicrophone()).resolves.toBe(false);
    });
  });

  describe('device change notices', () => {
    beforeEach(() => {
      vi.spyOn(Room, 'getLocalDevices').mockResolvedValue([
        device('usb-1', 'USB Headset', 'audioinput'),
        device('speaker-1', 'Bluetooth Speaker', 'audiooutput'),
        device('empty-1', '', 'audioinput'),
      ]);
    });

    it('does not announce the first binding of the default device to a concrete id', async () => {
      service.attach(room, 'call');

      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'usb-1');
      await Promise.resolve();
      await Promise.resolve();

      expect(service.deviceNotice()).toBeNull();
    });

    it('announces the microphone LiveKit switched to when a headset disappears', async () => {
      service.attach(room, 'call');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'bt-1');

      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'usb-1');

      await vi.waitFor(() =>
        expect(service.deviceNotice()).toEqual({ kind: 'audioinput', label: 'USB Headset' }),
      );
    });

    it('announces a change of speaker', async () => {
      service.attach(room, 'call');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audiooutput', 'earpiece-1');

      room.emit(RoomEvent.ActiveDeviceChanged, 'audiooutput', 'speaker-1');

      await vi.waitFor(() =>
        expect(service.deviceNotice()).toEqual({ kind: 'audiooutput', label: 'Bluetooth Speaker' }),
      );
    });

    it('announces when the system default device changes underneath the default alias', async () => {
      service.attach(room, 'call');

      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'default');

      await vi.waitFor(() =>
        expect(service.deviceNotice()).toEqual({ kind: 'audioinput', label: null }),
      );
    });

    it('announces without a label when the browser does not provide one', async () => {
      service.attach(room, 'call');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'bt-1');

      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'empty-1');

      await vi.waitFor(() =>
        expect(service.deviceNotice()).toEqual({ kind: 'audioinput', label: null }),
      );
    });

    it('still announces when the device list cannot be read', async () => {
      vi.spyOn(Room, 'getLocalDevices').mockRejectedValue(new Error('enumerate failed'));
      service.attach(room, 'call');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'bt-1');

      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'usb-1');

      await vi.waitFor(() =>
        expect(service.deviceNotice()).toEqual({ kind: 'audioinput', label: null }),
      );
    });

    it('ignores camera changes', async () => {
      service.attach(room, 'call');
      room.emit(RoomEvent.ActiveDeviceChanged, 'videoinput', 'cam-1');
      room.emit(RoomEvent.ActiveDeviceChanged, 'videoinput', 'cam-2');
      await Promise.resolve();
      await Promise.resolve();

      expect(service.deviceNotice()).toBeNull();
    });

    it('shows only the latest change when two arrive back to back', async () => {
      const lookups: Array<(devices: MediaDeviceInfo[]) => void> = [];
      vi.spyOn(Room, 'getLocalDevices').mockImplementation(
        () => new Promise<MediaDeviceInfo[]>((resolve) => lookups.push(resolve)),
      );
      service.attach(room, 'call');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'first-1');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'bt-1');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'usb-1');
      expect(lookups).toHaveLength(2);

      const listed = [
        device('bt-1', 'Label bt-1', 'audioinput'),
        device('usb-1', 'Label usb-1', 'audioinput'),
      ];
      lookups[1](listed);
      lookups[0](listed);
      await vi.waitFor(() => expect(service.deviceNotice()).not.toBeNull());
      await Promise.resolve();

      expect(service.deviceNotice()?.label).toBe('Label usb-1');
    });

    it('does not resurrect a notice that was dismissed while its label was loading', async () => {
      let finishLookup: (devices: MediaDeviceInfo[]) => void = () => undefined;
      vi.spyOn(Room, 'getLocalDevices').mockImplementation(
        () => new Promise<MediaDeviceInfo[]>((resolve) => (finishLookup = resolve)),
      );
      service.attach(room, 'call');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'bt-1');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'usb-1');

      service.dismissDeviceNotice();
      finishLookup([device('usb-1', 'USB Headset', 'audioinput')]);
      await Promise.resolve();
      await Promise.resolve();

      expect(service.deviceNotice()).toBeNull();
    });

    it('lets the person dismiss the notice', async () => {
      service.attach(room, 'call');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'bt-1');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'usb-1');
      await vi.waitFor(() => expect(service.deviceNotice()).not.toBeNull());

      service.dismissDeviceNotice();

      expect(service.deviceNotice()).toBeNull();
    });

    it('never writes device labels or ids to the logs', async () => {
      service.attach(room, 'call');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'bt-1');
      room.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'usb-1');
      await vi.waitFor(() => expect(service.deviceNotice()).not.toBeNull());

      const written = JSON.stringify([
        logger.info.mock.calls,
        logger.warn.mock.calls,
        logger.error.mock.calls,
      ]);
      expect(written).not.toContain('USB Headset');
      expect(written).not.toContain('usb-1');
      expect(written).not.toContain('bt-1');
      expect(logger.info).toHaveBeenCalledWith('audio-device-changed', 'CallAudioSession', {
        kind: 'audioinput',
      });
    });
  });

  describe('microphone device loss', () => {
    function useActiveInput(deviceId: string | undefined): void {
      vi.spyOn(room, 'getActiveDevice').mockImplementation((kind) =>
        kind === 'audioinput' ? deviceId : 'default',
      );
    }

    it('restarts the microphone on the first listed device when the active one disappears', async () => {
      useActiveInput('bt-1');
      vi.spyOn(Room, 'getLocalDevices').mockResolvedValue([
        device('usb-1', 'USB Headset', 'audioinput'),
      ]);
      const switchDevice = vi.spyOn(room, 'switchActiveDevice').mockResolvedValue(true);
      service.attach(room, 'call');

      room.emit(RoomEvent.MediaDevicesChanged);

      await vi.waitFor(() =>
        expect(switchDevice).toHaveBeenCalledWith('audioinput', 'usb-1', false),
      );
    });

    it('leaves the microphone alone while the active device is still listed', async () => {
      useActiveInput('usb-1');
      const getDevices = vi
        .spyOn(Room, 'getLocalDevices')
        .mockResolvedValue([device('usb-1', 'USB Headset', 'audioinput')]);
      const switchDevice = vi.spyOn(room, 'switchActiveDevice').mockResolvedValue(true);
      service.attach(room, 'call');

      room.emit(RoomEvent.MediaDevicesChanged);
      await vi.waitFor(() => expect(getDevices).toHaveBeenCalled());
      await Promise.resolve();

      expect(switchDevice).not.toHaveBeenCalled();
    });

    it('does not enumerate devices when the microphone follows the system default', async () => {
      useActiveInput('default');
      const getDevices = vi.spyOn(Room, 'getLocalDevices').mockResolvedValue([]);
      service.attach(room, 'call');

      room.emit(RoomEvent.MediaDevicesChanged);
      await Promise.resolve();

      expect(getDevices).not.toHaveBeenCalled();
    });

    it('does not enumerate devices for a listener who never published a microphone', async () => {
      useActiveInput(undefined);
      const getDevices = vi.spyOn(Room, 'getLocalDevices').mockResolvedValue([]);
      service.attach(room, 'call');

      room.emit(RoomEvent.MediaDevicesChanged);
      await Promise.resolve();

      expect(getDevices).not.toHaveBeenCalled();
    });

    it('leaves recovery to LiveKit while an ended microphone is being restarted', async () => {
      const mic = usePublishedMicrophone();
      useActiveInput('bt-1');
      const getDevices = vi.spyOn(Room, 'getLocalDevices').mockResolvedValue([]);
      service.attach(room, 'call');
      mic.emit(TrackEvent.Ended);

      room.emit(RoomEvent.MediaDevicesChanged);
      await Promise.resolve();

      expect(getDevices).not.toHaveBeenCalled();
    });

    it('flags the microphone when no input device remains', async () => {
      useActiveInput('bt-1');
      vi.spyOn(Room, 'getLocalDevices').mockResolvedValue([]);
      service.attach(room, 'call');

      room.emit(RoomEvent.MediaDevicesChanged);

      await vi.waitFor(() => expect(service.microphoneInterrupted()).toBe(true));
      expect(logger.warn).toHaveBeenCalledWith('microphone-interrupted', 'CallAudioSession', {
        reason: 'device-missing',
      });
    });

    it('flags the microphone and reports the failure when the fallback cannot be opened', async () => {
      useActiveInput('bt-1');
      vi.spyOn(Room, 'getLocalDevices').mockResolvedValue([
        device('usb-1', 'USB Headset', 'audioinput'),
      ]);
      vi.spyOn(room, 'switchActiveDevice').mockRejectedValue(
        new DOMException('busy', 'NotReadableError'),
      );
      service.attach(room, 'call');

      room.emit(RoomEvent.MediaDevicesChanged);

      await vi.waitFor(() => expect(service.microphoneInterrupted()).toBe(true));
      expect(logger.error).toHaveBeenCalledWith('audio-input-fallback-failed', 'CallAudioSession', {
        reason: 'NotReadableError',
      });
    });

    it('runs one more check when a second device change arrives mid-check', async () => {
      useActiveInput('usb-1');
      const resolvers: Array<(devices: MediaDeviceInfo[]) => void> = [];
      const getDevices = vi
        .spyOn(Room, 'getLocalDevices')
        .mockImplementation(
          () => new Promise<MediaDeviceInfo[]>((resolve) => resolvers.push(resolve)),
        );
      service.attach(room, 'call');

      room.emit(RoomEvent.MediaDevicesChanged);
      room.emit(RoomEvent.MediaDevicesChanged);
      room.emit(RoomEvent.MediaDevicesChanged);
      expect(getDevices).toHaveBeenCalledTimes(1);

      resolvers[0]([device('usb-1', 'USB Headset', 'audioinput')]);
      await vi.waitFor(() => expect(getDevices).toHaveBeenCalledTimes(2));
      resolvers[1]([device('usb-1', 'USB Headset', 'audioinput')]);
      await Promise.resolve();
      await Promise.resolve();

      expect(getDevices).toHaveBeenCalledTimes(2);
    });

    it('checks the microphone again when the page returns to the foreground', async () => {
      useActiveInput('bt-1');
      vi.spyOn(Room, 'getLocalDevices').mockResolvedValue([
        device('usb-1', 'USB Headset', 'audioinput'),
      ]);
      const switchDevice = vi.spyOn(room, 'switchActiveDevice').mockResolvedValue(true);
      service.attach(room, 'call');

      setVisibility('visible');

      await vi.waitFor(() =>
        expect(switchDevice).toHaveBeenCalledWith('audioinput', 'usb-1', false),
      );
    });

    it('abandons a check when the session ends while devices are being listed', async () => {
      useActiveInput('bt-1');
      let finishLookup: (devices: MediaDeviceInfo[]) => void = () => undefined;
      vi.spyOn(Room, 'getLocalDevices').mockImplementation(
        () => new Promise<MediaDeviceInfo[]>((resolve) => (finishLookup = resolve)),
      );
      const switchDevice = vi.spyOn(room, 'switchActiveDevice').mockResolvedValue(true);
      service.attach(room, 'call');
      room.emit(RoomEvent.MediaDevicesChanged);

      service.detach(room);
      finishLookup([device('usb-1', 'USB Headset', 'audioinput')]);
      await Promise.resolve();
      await Promise.resolve();

      expect(switchDevice).not.toHaveBeenCalled();
    });
  });

  describe('diagnostics', () => {
    it('logs attach and detach with the session kind only', () => {
      service.attach(room, 'room');
      service.detach(room);

      expect(logger.info).toHaveBeenCalledWith('session-attached', 'CallAudioSession', {
        kind: 'room',
      });
      expect(logger.info).toHaveBeenCalledWith('session-detached', 'CallAudioSession', undefined);
    });

    it('keeps working when logging itself fails', () => {
      logger.info.mockImplementation(() => {
        throw new Error('logger unavailable');
      });

      expect(() => service.attach(room, 'call')).not.toThrow();
      expect(service.isActive()).toBe(true);
    });
  });
});
