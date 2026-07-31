import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { VideoCallComponent } from './video-call.component';
import { LivekitService } from '../../services/livekit.service';
import { LocalTrackPublication, RemoteTrack, Track } from 'livekit-client';

interface MockRoom {
  localParticipant: {
    setScreenShareEnabled: ReturnType<typeof vi.fn>;
  };
  disconnect: ReturnType<typeof vi.fn>;
}

describe('VideoCallComponent - screen sharing', () => {
  let component: VideoCallComponent;
  let fixture: ComponentFixture<VideoCallComponent>;
  let componentRef: ComponentRef<VideoCallComponent>;
  let mockLivekitService: Mocked<LivekitService>;
  let mockRoom: MockRoom;

  beforeEach(async () => {
    mockLivekitService = {
      getToken: vi.fn().mockResolvedValue('fake-token'),
      getLiveKitUrl: vi.fn().mockReturnValue('wss://example.test'),
    } as unknown as Mocked<LivekitService>;

    await TestBed.configureTestingModule({
      imports: [VideoCallComponent],
      providers: [{ provide: LivekitService, useValue: mockLivekitService }],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoCallComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;

    componentRef.setInput('roomName', 'room-1');
    componentRef.setInput('otherUserId', 'user-456');
    componentRef.setInput('otherUserName', 'Alice');
    componentRef.setInput('otherUserInitials', 'A');

    // Bypass ngOnInit's real LiveKit connection flow (this component talks to the
    // 'livekit-client' Room class directly rather than through a mockable service) by
    // never running change detection and instead injecting a fake connected room.
    mockRoom = {
      localParticipant: {
        setScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
      },
      disconnect: vi.fn(),
    };
    (component as unknown as { room: MockRoom | null }).room = mockRoom;
  });

  it('starts screen sharing via LiveKit setScreenShareEnabled when not currently sharing', async () => {
    await component.toggleScreenShare();

    expect(mockRoom.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true);
  });

  it('stops screen sharing via LiveKit setScreenShareEnabled when already sharing', async () => {
    component.isScreenSharing.set(true);

    await component.toggleScreenShare();

    expect(mockRoom.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(false);
  });

  it('does nothing when not connected to a room', async () => {
    (component as unknown as { room: MockRoom | null }).room = null;

    await expect(component.toggleScreenShare()).resolves.toBeUndefined();
  });

  it('swallows errors from a cancelled share picker without throwing', async () => {
    mockRoom.localParticipant.setScreenShareEnabled.mockRejectedValueOnce(
      new Error('Permission denied'),
    );

    await expect(component.toggleScreenShare()).resolves.toBeUndefined();
  });

  it('flags isScreenSharing when the local screen-share track publishes', () => {
    const publication = { source: Track.Source.ScreenShare } as unknown as LocalTrackPublication;

    (
      component as unknown as { onLocalTrackPublished: (p: LocalTrackPublication) => void }
    ).onLocalTrackPublished(publication);

    expect(component.isScreenSharing()).toBe(true);
  });

  it('clears isScreenSharing when the screen-share track unpublishes (e.g. browser "Stop sharing" UI)', () => {
    component.isScreenSharing.set(true);
    const publication = { source: Track.Source.ScreenShare } as unknown as LocalTrackPublication;

    (
      component as unknown as { onLocalTrackUnpublished: (p: LocalTrackPublication) => void }
    ).onLocalTrackUnpublished(publication);

    expect(component.isScreenSharing()).toBe(false);
  });

  it('ignores local camera publish/unpublish events for the screen-share flag', () => {
    const publication = { source: Track.Source.Camera } as unknown as LocalTrackPublication;

    (
      component as unknown as { onLocalTrackPublished: (p: LocalTrackPublication) => void }
    ).onLocalTrackPublished(publication);

    expect(component.isScreenSharing()).toBe(false);
  });

  it('routes remote camera and screen-share tracks to separate signals, prioritising screen share in mainVideoTrack', () => {
    const cameraTrack = {
      kind: Track.Kind.Video,
      source: Track.Source.Camera,
      detach: vi.fn(),
    } as unknown as RemoteTrack;
    const screenTrack = {
      kind: Track.Kind.Video,
      source: Track.Source.ScreenShare,
      detach: vi.fn(),
    } as unknown as RemoteTrack;
    const onTrackSubscribed = (
      component as unknown as { onTrackSubscribed: (t: RemoteTrack) => void }
    ).onTrackSubscribed.bind(component);
    const onTrackUnsubscribed = (
      component as unknown as { onTrackUnsubscribed: (t: RemoteTrack) => void }
    ).onTrackUnsubscribed.bind(component);

    onTrackSubscribed(cameraTrack);
    expect(component.remoteCameraTrack()).toBe(cameraTrack);
    expect(component.mainVideoTrack()).toBe(cameraTrack);
    expect(component.isRemoteScreenSharing()).toBe(false);

    onTrackSubscribed(screenTrack);
    expect(component.remoteScreenShareTrack()).toBe(screenTrack);
    expect(component.mainVideoTrack()).toBe(screenTrack);
    expect(component.isRemoteScreenSharing()).toBe(true);
    // The camera track is still tracked separately (shown as a thumbnail) rather than
    // being clobbered by the screen-share subscription.
    expect(component.remoteCameraTrack()).toBe(cameraTrack);

    // Unsubscribing the screen share should fall back to the still-active camera track
    // instead of clearing the whole remote view - this was the pre-fix bug, where a
    // single remoteVideoTrack signal was overwritten by whichever track (un)subscribed last.
    onTrackUnsubscribed(screenTrack);
    expect(component.remoteScreenShareTrack()).toBeNull();
    expect(component.mainVideoTrack()).toBe(cameraTrack);
    expect(component.isRemoteScreenSharing()).toBe(false);
  });

  it('ignores non-video remote tracks', () => {
    const audioTrack = {
      kind: Track.Kind.Audio,
      source: Track.Source.Microphone,
    } as unknown as RemoteTrack;

    (
      component as unknown as { onTrackSubscribed: (t: RemoteTrack) => void }
    ).onTrackSubscribed(audioTrack);

    expect(component.remoteCameraTrack()).toBeNull();
    expect(component.remoteScreenShareTrack()).toBeNull();
  });
});
