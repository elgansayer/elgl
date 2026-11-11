import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import {
  isAudioTrack,
  LocalTrack,
  LocalTrackPublication,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  TrackEvent,
} from 'livekit-client';
import type { RoomEventCallbacks } from 'livekit-client';
import { LoggingService } from './logging.service';

const LOG_CONTEXT = 'CallAudioSession';

/** Browsers expose the operating-system default device under this id. */
const DEFAULT_DEVICE_ID = 'default';

/** A one-to-one call keeps the app lock waiting; a room does not. */
export type CallAudioSessionKind = 'call' | 'room';

export type CallAudioDeviceKind = 'audioinput' | 'audiooutput';

export interface CallAudioDeviceNotice {
  readonly kind: CallAudioDeviceKind;
  /** Browser-provided label. Shown to the user only and never written to logs. */
  readonly label: string | null;
}

type MicrophoneProblem =
  'ended' | 'upstream-paused' | 'silence' | 'device-error' | 'device-missing';

interface ActiveSession {
  readonly room: Room;
  readonly kind: CallAudioSessionKind;
}

interface RemoteAudioBinding {
  readonly element: HTMLMediaElement;
  readonly onPause: () => void;
}

const MAX_FAILURE_NAME_LENGTH = 64;

/**
 * The name of a failure, such as `NotAllowedError`. It is read structurally because a
 * `DOMException` from another realm is not an `instanceof Error`. Messages are never read:
 * they can carry device identifiers.
 */
function failureName(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string' &&
    error.name.length > 0
  ) {
    return error.name.slice(0, MAX_FAILURE_NAME_LENGTH);
  }
  return 'UnknownError';
}

/**
 * Keeps LiveKit audio usable through the events that break it in practice: a Bluetooth
 * headset connecting or disconnecting, the operating system taking the microphone away (phone
 * calls, other apps), headset media keys pausing playback, the browser blocking audio
 * playback, and the page moving to the background.
 *
 * It owns remote audio rendering for the room it is attached to, so every call surface gets
 * the same recovery behaviour. The services and stores that create a `Room` call `attach` once
 * connected and `detach` when they leave. State is exposed as signals for the shell banner.
 */
@Injectable({ providedIn: 'root' })
export class CallAudioSessionService {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  private readonly session = signal<ActiveSession | null>(null);
  private readonly playbackBlockedState = signal(false);
  private readonly microphoneInterruptedState = signal(false);
  private readonly deviceNoticeState = signal<CallAudioDeviceNotice | null>(null);

  /** True while a LiveKit room is attached. */
  readonly isActive = computed(() => this.session() !== null);
  /** True while a one-to-one call is attached. The app lock waits for these. */
  readonly isCallActive = computed(() => this.session()?.kind === 'call');
  /** True when the browser or operating system is not letting remote audio play. */
  readonly playbackBlocked = this.playbackBlockedState.asReadonly();
  /** True when the local microphone stopped delivering audio and needs a restart. */
  readonly microphoneInterrupted = this.microphoneInterruptedState.asReadonly();
  /** The latest unrequested change of microphone or speaker, until it is dismissed. */
  readonly deviceNotice = this.deviceNoticeState.asReadonly();

  private readonly cleanups: Array<() => void> = [];
  private readonly remoteAudio = new Map<RemoteTrack, RemoteAudioBinding>();
  private readonly knownDevices = new Map<CallAudioDeviceKind, string>();
  private unwatchMicrophoneTrack: (() => void) | null = null;
  private sink: HTMLElement | null = null;
  /** The microphone track ended and LiveKit is still restarting it on another device. */
  private microphoneEnded = false;
  private reconciling = false;
  private reconcileAgain = false;
  private noticeSequence = 0;

  /**
   * Starts managing audio for a connected room. Attaching a different room first releases the
   * previous one, so a stale owner can never keep a dead session alive.
   */
  attach(room: Room, kind: CallAudioSessionKind): void {
    if (this.session()?.room === room) {
      return;
    }
    this.teardown();
    this.session.set({ room, kind });

    this.listen(room, RoomEvent.TrackSubscribed, (track) => this.attachRemoteAudio(track));
    this.listen(room, RoomEvent.TrackUnsubscribed, (track) => this.detachRemoteAudio(track));
    this.listen(room, RoomEvent.AudioPlaybackStatusChanged, (canPlayback) =>
      this.onPlaybackStatusChanged(canPlayback),
    );
    this.listen(room, RoomEvent.MediaDevicesChanged, () => this.requestReconcile());
    this.listen(room, RoomEvent.ActiveDeviceChanged, (deviceKind, deviceId) =>
      this.onActiveDeviceChanged(room, deviceKind, deviceId),
    );
    this.listen(room, RoomEvent.MediaDevicesError, (error, deviceKind) => {
      if (deviceKind === 'audioinput') {
        this.onMicrophoneProblem('device-error', failureName(error));
      }
    });
    this.listen(room, RoomEvent.LocalTrackPublished, (publication) =>
      this.onLocalTrackPublished(publication),
    );
    this.listen(room, RoomEvent.LocalTrackUnpublished, (publication) =>
      this.onLocalTrackUnpublished(publication),
    );
    this.listen(room, RoomEvent.LocalAudioSilenceDetected, () =>
      this.onMicrophoneProblem('silence'),
    );
    // A room can end without its owner noticing (removed by the host, network lost for good).
    // Release the session so the lock and the banner never wait on a dead call.
    this.listen(room, RoomEvent.Disconnected, () => this.detach(room));

    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.cleanups.push(() =>
      this.document.removeEventListener('visibilitychange', this.onVisibilityChange),
    );

    this.knownDevices.set('audioinput', room.getActiveDevice('audioinput') ?? DEFAULT_DEVICE_ID);
    this.knownDevices.set('audiooutput', room.getActiveDevice('audiooutput') ?? DEFAULT_DEVICE_ID);

    // Tracks subscribed while the room was connecting are not replayed to new listeners.
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.audioTrackPublications.values()) {
        if (publication.track) {
          this.attachRemoteAudio(publication.track);
        }
      }
    }
    this.watchMicrophone(room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track);
    this.playbackBlockedState.set(!room.canPlaybackAudio);

    this.report('info', 'session-attached', { kind });
  }

  /** Stops managing the room. Does nothing when the room is not the attached one. */
  detach(room: Room): void {
    if (this.session()?.room !== room) {
      return;
    }
    this.teardown();
    this.report('info', 'session-detached');
  }

  /**
   * Resumes remote audio the browser refused to play. Call it from a user gesture: browsers
   * only lift an autoplay block in response to one.
   */
  async resumePlayback(): Promise<boolean> {
    const current = this.session();
    if (!current) {
      return false;
    }
    try {
      await current.room.startAudio();
    } catch (error) {
      this.report('warn', 'playback-resume-rejected', { reason: failureName(error) });
      return false;
    }
    if (this.session()?.room === current.room) {
      this.playbackBlockedState.set(false);
    }
    return true;
  }

  /**
   * Re-acquires the microphone on the system default device. The previous device is often the
   * Bluetooth headset that just disconnected, so the track is restarted on the default rather
   * than on the device it last used.
   */
  async recoverMicrophone(): Promise<boolean> {
    const current = this.session();
    if (!current) {
      return false;
    }
    const { room } = current;
    try {
      const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
      if (track) {
        await track.restartTrack({ deviceId: DEFAULT_DEVICE_ID });
        if (track.isMuted) {
          await track.unmute();
        }
      } else {
        await room.localParticipant.setMicrophoneEnabled(true);
      }
    } catch (error) {
      this.report('error', 'microphone-recovery-failed', { reason: failureName(error) });
      return false;
    }
    if (this.session()?.room === room) {
      this.microphoneEnded = false;
      this.microphoneInterruptedState.set(false);
    }
    return true;
  }

  dismissMicrophoneNotice(): void {
    this.microphoneInterruptedState.set(false);
  }

  dismissDeviceNotice(): void {
    this.noticeSequence += 1;
    this.deviceNoticeState.set(null);
  }

  private listen<E extends keyof RoomEventCallbacks>(
    room: Room,
    event: E,
    listener: RoomEventCallbacks[E],
  ): void {
    room.on(event, listener);
    this.cleanups.push(() => {
      room.off(event, listener);
    });
  }

  private readonly onVisibilityChange = (): void => {
    if (this.document.visibilityState !== 'visible' || !this.session()) {
      return;
    }
    // Browsers pause media and throttle device events while a page is hidden. Check both on return.
    const stalled =
      this.playbackBlockedState() ||
      [...this.remoteAudio.values()].some(({ element }) => element.paused);
    if (stalled) {
      void this.resumePlayback();
    }
    this.requestReconcile();
  };

  private onPlaybackStatusChanged(canPlayback: boolean): void {
    this.playbackBlockedState.set(!canPlayback);
    if (!canPlayback) {
      this.report('warn', 'playback-blocked');
    }
  }

  private attachRemoteAudio(track: RemoteTrack): void {
    if (!isAudioTrack(track) || this.remoteAudio.has(track)) {
      return;
    }
    const element = track.attach();
    element.setAttribute('data-call-audio', 'remote');
    // A headset media key or an operating-system interruption pauses the element. A call must
    // never stay paused, so start it again straight away.
    const onPause = (): void => {
      void this.resumeElement(element);
    };
    element.addEventListener('pause', onPause);
    this.getSink().appendChild(element);
    this.remoteAudio.set(track, { element, onPause });
  }

  private detachRemoteAudio(track: RemoteTrack): void {
    const binding = this.remoteAudio.get(track);
    if (!binding) {
      return;
    }
    // Remove the listener first: detaching pauses the element and must not restart it.
    binding.element.removeEventListener('pause', binding.onPause);
    this.remoteAudio.delete(track);
    for (const element of track.detach()) {
      element.remove();
    }
  }

  private async resumeElement(element: HTMLMediaElement): Promise<void> {
    if (!this.session()) {
      return;
    }
    try {
      await element.play();
    } catch (error) {
      if (failureName(error) === 'NotAllowedError') {
        this.playbackBlockedState.set(true);
      }
    }
  }

  private getSink(): HTMLElement {
    if (!this.sink) {
      const sink = this.document.createElement('div');
      sink.hidden = true;
      sink.setAttribute('data-call-audio-sink', '');
      this.document.body.appendChild(sink);
      this.sink = sink;
    }
    return this.sink;
  }

  private onLocalTrackPublished(publication: LocalTrackPublication): void {
    if (publication.source === Track.Source.Microphone) {
      this.watchMicrophone(publication.track);
    }
  }

  private onLocalTrackUnpublished(publication: LocalTrackPublication): void {
    if (publication.source === Track.Source.Microphone) {
      this.watchMicrophone(undefined);
      this.microphoneInterruptedState.set(false);
    }
  }

  /**
   * LiveKit restarts an ended microphone on the default device by itself, and mutes the track
   * when that fails. The mute is the only sign of the failure, and it looks the same as a
   * deliberate mute, so it only counts after an `ended` that was never followed by a restart.
   */
  private watchMicrophone(track: LocalTrack | undefined): void {
    this.unwatchMicrophoneTrack?.();
    this.unwatchMicrophoneTrack = null;
    this.microphoneEnded = false;
    if (!track) {
      return;
    }

    const onEnded = (): void => {
      this.microphoneEnded = true;
    };
    const onRecovered = (): void => {
      this.microphoneEnded = false;
      this.microphoneInterruptedState.set(false);
    };
    const onMuted = (): void => {
      if (this.microphoneEnded) {
        this.onMicrophoneProblem('ended');
      }
    };
    const onUpstreamPaused = (): void => this.onMicrophoneProblem('upstream-paused');
    const onUpstreamResumed = (): void => this.microphoneInterruptedState.set(false);
    // LiveKit checks for silence again after every restart, which is how a headset that comes
    // back without a working microphone shows up. A muted track is silent by design.
    const onSilence = (): void => {
      if (!track.isMuted) {
        this.onMicrophoneProblem('silence');
      }
    };

    track.on(TrackEvent.Ended, onEnded);
    track.on(TrackEvent.Restarted, onRecovered);
    track.on(TrackEvent.Unmuted, onRecovered);
    track.on(TrackEvent.Muted, onMuted);
    track.on(TrackEvent.UpstreamPaused, onUpstreamPaused);
    track.on(TrackEvent.UpstreamResumed, onUpstreamResumed);
    track.on(TrackEvent.AudioSilenceDetected, onSilence);
    this.unwatchMicrophoneTrack = () => {
      track.off(TrackEvent.Ended, onEnded);
      track.off(TrackEvent.Restarted, onRecovered);
      track.off(TrackEvent.Unmuted, onRecovered);
      track.off(TrackEvent.Muted, onMuted);
      track.off(TrackEvent.UpstreamPaused, onUpstreamPaused);
      track.off(TrackEvent.UpstreamResumed, onUpstreamResumed);
      track.off(TrackEvent.AudioSilenceDetected, onSilence);
    };
  }

  private onMicrophoneProblem(reason: MicrophoneProblem, failure?: string): void {
    // Several signals describe one failure (a silent microphone is reported by both the room
    // and the track). The first is the cause worth logging.
    if (this.microphoneInterruptedState()) {
      return;
    }
    this.microphoneInterruptedState.set(true);
    this.report('warn', 'microphone-interrupted', failure ? { reason, failure } : { reason });
  }

  private onActiveDeviceChanged(room: Room, kind: MediaDeviceKind, deviceId: string): void {
    if (kind !== 'audioinput' && kind !== 'audiooutput') {
      return;
    }
    const previous = this.knownDevices.get(kind);
    this.knownDevices.set(kind, deviceId);
    // The first event after publishing only binds the default device to its concrete id.
    // Nothing changed for the user, so it is not worth announcing.
    if (previous === DEFAULT_DEVICE_ID && deviceId !== DEFAULT_DEVICE_ID) {
      return;
    }
    void this.announceDeviceChange(room, kind, deviceId);
  }

  private async announceDeviceChange(
    room: Room,
    kind: CallAudioDeviceKind,
    deviceId: string,
  ): Promise<void> {
    this.noticeSequence += 1;
    const sequence = this.noticeSequence;
    let label: string | null = null;
    try {
      const devices = await Room.getLocalDevices(kind, false);
      label = devices.find((device) => device.deviceId === deviceId)?.label || null;
    } catch {
      // The label is a nicety. The notice is still useful without it.
    }
    if (this.session()?.room !== room || sequence !== this.noticeSequence) {
      return;
    }
    this.deviceNoticeState.set({ kind, label });
    this.report('info', 'audio-device-changed', { kind });
  }

  private requestReconcile(): void {
    if (!this.session()) {
      return;
    }
    if (this.reconciling) {
      this.reconcileAgain = true;
      return;
    }
    this.reconciling = true;
    void this.reconcileMicrophoneDevice().finally(() => {
      this.reconciling = false;
      if (this.reconcileAgain) {
        this.reconcileAgain = false;
        this.requestReconcile();
      }
    });
  }

  /**
   * LiveKit moves the microphone to another device when the one in use disappears, except on
   * iOS, where it leaves default devices alone. When the device the room believes is active is
   * no longer listed and LiveKit is not already restarting the track, restart the microphone on
   * the first device that is listed.
   */
  private async reconcileMicrophoneDevice(): Promise<void> {
    const current = this.session();
    if (!current) {
      return;
    }
    const { room } = current;
    const activeId = room.getActiveDevice('audioinput');
    if (!activeId || activeId === DEFAULT_DEVICE_ID || this.microphoneEnded) {
      return;
    }
    try {
      const devices = await Room.getLocalDevices('audioinput', false);
      if (this.session()?.room !== room) {
        return;
      }
      if (devices.some((device) => device.deviceId === activeId)) {
        return;
      }
      const fallback = devices.find((device) => device.deviceId !== '');
      if (!fallback) {
        this.onMicrophoneProblem('device-missing');
        return;
      }
      await room.switchActiveDevice('audioinput', fallback.deviceId, false);
    } catch (error) {
      this.microphoneInterruptedState.set(true);
      this.report('error', 'audio-input-fallback-failed', { reason: failureName(error) });
    }
  }

  private teardown(): void {
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      cleanup();
    }
    this.unwatchMicrophoneTrack?.();
    this.unwatchMicrophoneTrack = null;
    for (const track of [...this.remoteAudio.keys()]) {
      this.detachRemoteAudio(track);
    }
    this.sink?.remove();
    this.sink = null;
    this.knownDevices.clear();
    this.microphoneEnded = false;
    this.reconcileAgain = false;
    this.noticeSequence += 1;
    this.playbackBlockedState.set(false);
    this.microphoneInterruptedState.set(false);
    this.deviceNoticeState.set(null);
    this.session.set(null);
  }

  /**
   * Logging is resolved on use so attaching a room never pulls the crash-reporting chain into
   * every call surface. Entries carry enumerated reasons only: never device labels or ids.
   */
  private report(
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, string>,
  ): void {
    try {
      this.injector.get(LoggingService)[level](message, LOG_CONTEXT, data);
    } catch {
      // Diagnostics must never get in the way of recovering call audio.
    }
  }
}
