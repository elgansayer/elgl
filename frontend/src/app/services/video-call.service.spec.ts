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
