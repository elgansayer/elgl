import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { VideoCallService } from './video-call.service';

vi.mock('livekit-client', () => {
  const mockRoom = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    localParticipant: {
      enableCameraAndMicrophone: vi.fn().mockResolvedValue(undefined),
      getTrackPublication: vi.fn().mockReturnValue(null),
      setCameraEnabled: vi.fn().mockResolvedValue(undefined),
      setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
    },
    remoteParticipants: new Map(),
  };

  return {
    Room: vi.fn().mockImplementation(function () {
      return mockRoom;
    }),
    ExternalE2EEKeyProvider: vi.fn().mockImplementation(function () {
      return {
        setKey: vi.fn().mockResolvedValue(undefined),
      };
    }),
    VideoPresets: {
      h720: { resolution: { width: 1280, height: 720 } },
    },
    RoomEvent: {
      ParticipantConnected: 'participantConnected',
      TrackSubscribed: 'trackSubscribed',
      TrackUnsubscribed: 'trackUnsubscribed',
      Disconnected: 'disconnected',
      ConnectionStateChanged: 'connectionStateChanged',
    },
    Track: {
      Source: { Camera: 'camera', Microphone: 'microphone' },
    },
  };
});

describe('VideoCallService E2EE', () => {
  let service: VideoCallService;
  let httpMock: HttpTestingController;

  const mockAuthService = {
    getAccessToken: () => 'valid-access-token',
    currentUser: () => ({ id: 'caller-user' }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        VideoCallService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    service = TestBed.inject(VideoCallService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('configures end-to-end encryption when e2eeKey is returned by the server', async () => {
    const startCallPromise = service.startCall('recipient-user');

    const req = httpMock.expectOne(`${environment.apiUrl}/video-calls/start`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ remoteUserId: 'recipient-user' });

    req.flush({
      token: 'jwt-call-token',
      roomName: 'video_11111111-2222-3333-4444-555555555555',
      e2eeKey: 'ephemeral-e2ee-key-material',
    });

    await startCallPromise;

    expect(service.isEncrypted()).toBe(true);
    expect(service.callState()?.isConnected).toBe(true);
  });

  it('configures end-to-end encryption upon accepting an incoming call with key', async () => {
    await service.acceptCall(
      'video_11111111-2222-3333-4444-555555555555',
      'callee-token',
      'ephemeral-e2ee-key-material',
    );

    expect(service.isEncrypted()).toBe(true);
    expect(service.callState()?.isConnected).toBe(true);
  });

  it('resets encryption state upon ending the call', async () => {
    await service.acceptCall(
      'video_11111111-2222-3333-4444-555555555555',
      'callee-token',
      'ephemeral-e2ee-key-material',
    );

    expect(service.isEncrypted()).toBe(true);

    await service.endCall();

    expect(service.isEncrypted()).toBe(false);
    expect(service.callState()).toBeNull();
  });
});
