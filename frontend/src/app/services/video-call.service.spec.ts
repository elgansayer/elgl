import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { VideoCallService } from './video-call.service';

describe('VideoCallService E2EE', () => {
  let service: VideoCallService;
  let httpMock: HttpTestingController;
  let mockAuthService: {
    getAccessToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('mock-jwt-token'),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        VideoCallService,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    });

    service = TestBed.inject(VideoCallService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fails closed when startCall receives response without E2EE key material', async () => {
    const startPromise = service.startCall('remote-user-123');

    const req = httpMock.expectOne(`${environment.apiUrl}/video-calls/start`);
    expect(req.request.method).toBe('POST');
    // Return payload missing e2eeKey
    req.flush({
      token: 'mock-livekit-token',
      roomName: 'video_11111111-2222-4333-8444-555555555555',
      e2eeKey: '',
    });

    await expect(startPromise).rejects.toThrow(
      'E2EE key material is missing from the authenticated call session.',
    );
    expect(service.isEncrypted()).toBe(false);
  });

  it('fails closed when acceptCall has missing key material', async () => {
    const acceptPromise = service.acceptCall(
      'video_11111111-2222-4333-8444-555555555555',
      'mock-token',
    );

    const req = httpMock.expectOne(`${environment.apiUrl}/video-calls/accept`);
    expect(req.request.method).toBe('POST');
    req.flush({
      token: 'mock-token',
      roomName: 'video_11111111-2222-4333-8444-555555555555',
      e2eeKey: '',
    });

    await expect(acceptPromise).rejects.toThrow(
      'E2EE key material is missing from the authenticated call session.',
    );
    expect(service.isEncrypted()).toBe(false);
  });
});

describe('VideoCallService call duration', () => {
  let service: VideoCallService;
  const connectedState = {
    roomName: 'video_11111111-2222-4333-8444-555555555555',
    remoteParticipantId: 'remote-user-123',
    isConnected: true,
    isMuted: false,
    isVideoOff: false,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        VideoCallService,
        { provide: AuthService, useValue: { getAccessToken: vi.fn() } },
      ],
    });
    service = TestBed.inject(VideoCallService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('stays at zero with no timer while there is no call', () => {
    vi.advanceTimersByTime(5000);

    expect(service.callDuration()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts seconds while connected without rewriting the call state each tick', () => {
    service.callState.set(connectedState);
    TestBed.tick();
    const stateBeforeTicks = service.callState();

    vi.advanceTimersByTime(4000);

    expect(service.callDuration()).toBe(4);
    expect(service.callState()).toBe(stateBeforeTicks);
  });

  it('keeps counting through mute and camera toggles', () => {
    service.callState.set(connectedState);
    TestBed.tick();
    vi.advanceTimersByTime(2000);

    service.callState.set({ ...connectedState, isMuted: true });
    TestBed.tick();
    vi.advanceTimersByTime(3000);

    expect(service.callDuration()).toBe(5);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('stops and resets the timer when the call ends', async () => {
    service.callState.set(connectedState);
    TestBed.tick();
    vi.advanceTimersByTime(3000);
    expect(vi.getTimerCount()).toBe(1);

    await service.endCall();
    TestBed.tick();

    expect(service.callDuration()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases the timer when the service injector is destroyed mid-call', () => {
    service.callState.set(connectedState);
    TestBed.tick();
    expect(vi.getTimerCount()).toBe(1);

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
  });
});
