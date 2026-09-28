import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoClassroomErrorHandlerService } from './video-classroom-error-handler.service';
import { AuthService } from './auth.service';

const API_ERROR_URL = 'http://localhost:3000/api/analytics/client-error';

describe('VideoClassroomErrorHandlerService', () => {
  let service: VideoClassroomErrorHandlerService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();

    const mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('mock-token'),
    };

    TestBed.configureTestingModule({
      providers: [
        VideoClassroomErrorHandlerService,
        { provide: AuthService, useValue: mockAuthService },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(VideoClassroomErrorHandlerService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should POST crash details to /api/analytics/client-error', () => {
    const testError = new Error('LiveKit room disconnect');
    service.reportVideoClassroomCrash(testError, {
      roomId: 'room-123',
      roomName: 'English Practice',
      isHost: true,
      livekitConnected: true,
      renderingError: true,
    });

    const req = httpTesting.expectOne(API_ERROR_URL);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('LiveKit room disconnect');
    expect(body['name']).toBe('Error');
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('video-classroom');
    expect(metadata['roomId']).toBe('room-123');
    expect(metadata['isHost']).toBe(true);
    expect(metadata['renderingError']).toBe(true);
    req.flush({ status: 'logged' });
  });

  it('should add crash to recentCrashes signal', () => {
    const testError = new Error('SFU crash');
    service.reportVideoClassroomCrash(testError, { action: 'connect' });

    httpTesting.expectOne(API_ERROR_URL).flush({ status: 'logged' });

    expect(service.recentCrashes().length).toBe(1);
    expect(service.recentCrashes()[0].message).toBe('SFU crash');
    expect(service.recentCrashes()[0].context).toBe('connect');
  });

  it('should limit recent crashes to MAX_RECENT_CRASHES (10)', () => {
    for (let i = 0; i < 15; i++) {
      service.reportVideoClassroomCrash(new Error(`Crash ${i}`), { action: 'test' });
      httpTesting.expectOne(API_ERROR_URL).flush({ status: 'logged' });
    }

    expect(service.recentCrashes().length).toBe(10);
    expect(service.recentCrashes()[0].message).toBe('Crash 14');
  });

  it('should silently handle API rejections', () => {
    const testError = new Error('Network timeout');
    service.reportVideoClassroomCrash(testError, { action: 'join' });

    const req = httpTesting.expectOne(API_ERROR_URL);
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    // Should not throw; recentCrashes should still be updated
    expect(service.recentCrashes().length).toBe(1);
  });

  it('wrapClassroomCall should return result on success', async () => {
    const result = await service.wrapClassroomCall('fetchRooms', async () => 'rooms-data');

    expect(result).toBe('rooms-data');
  });

  it('wrapClassroomCall should report crash and return null on non-429 error', async () => {
    const testError = new Error('API unreachable');
    const result = await service.wrapClassroomCall('fetchRooms', async () => {
      throw testError;
    }, { roomId: 'room-abc' });

    expect(result).toBeNull();
    expect(service.recentCrashes().length).toBe(1);
    expect(service.recentCrashes()[0].context).toBe('fetchRooms');

    const req = httpTesting.expectOne(API_ERROR_URL);
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('API unreachable');
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('video-classroom');
    req.flush({ status: 'logged' });
  });

  it('wrapClassroomCall should retry on HTTP 429 and succeed on retry', async () => {
    const rateLimitError = new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' });
    let callCount = 0;
    const fn = async (): Promise<string> => {
      callCount++;
      if (callCount === 1) {
        throw rateLimitError;
      }
      return 'retry-success';
    };

    const result = await service.wrapClassroomCall(
      'fetchRooms',
      fn,
      { roomId: 'room-429' },
      { maxRetries: 3, baseDelayMs: 1 },
    );

    expect(result).toBe('retry-success');
    expect(callCount).toBe(2);
    // No crash should be reported on successful retry
    expect(service.recentCrashes().length).toBe(0);
  });

  it('wrapClassroomCall should report crash after exhausting 429 retries', async () => {
    const rateLimitError = new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' });
    let callCount = 0;
    const fn = async (): Promise<string> => {
      callCount++;
      throw rateLimitError;
    };

    const result = await service.wrapClassroomCall(
      'fetchRooms',
      fn,
      { roomId: 'room-429-exhausted' },
      { maxRetries: 2, baseDelayMs: 1 },
    );

    expect(result).toBeNull();
    expect(callCount).toBe(3); // initial + 2 retries
    expect(service.recentCrashes().length).toBe(1);
    expect(service.recentCrashes()[0].context).toBe('fetchRooms');

    const req = httpTesting.expectOne(API_ERROR_URL);
    const body = req.request.body as Record<string, unknown>;
    expect((body['metadata'] as Record<string, unknown>)['roomId']).toBe('room-429-exhausted');
    req.flush({ status: 'logged' });
  });

  it('wrapClassroomCall throws immediately on non-429 HTTP error without retry', async () => {
    const serverError = new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' });
    let callCount = 0;
    const fn = async (): Promise<string> => {
      callCount++;
      throw serverError;
    };

    const result = await service.wrapClassroomCall(
      'fetchRooms',
      fn,
      { roomId: 'room-500' },
      { maxRetries: 3, baseDelayMs: 1 },
    );

    expect(result).toBeNull();
    expect(callCount).toBe(1); // no retry on 500
    expect(service.recentCrashes().length).toBe(1);

    const req = httpTesting.expectOne(API_ERROR_URL);
    const body = req.request.body as Record<string, unknown>;
    expect((body['metadata'] as Record<string, unknown>)['roomId']).toBe('room-500');
    req.flush({ status: 'logged' });
  });
});