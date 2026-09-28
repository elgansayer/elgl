import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { describe, beforeEach, afterEach, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { LivekitService } from './livekit.service';

describe('LivekitService E2EE contract', () => {
  let service: LivekitService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LivekitService],
    });
    service = TestBed.inject(LivekitService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns authenticated E2EE key material with join tokens', async () => {
    const request = service.getToken(
      'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
      'user-123',
    );

    const req = httpMock.expectOne(`${environment.apiUrl}/video-calls/accept`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      roomName: 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
    });
    req.flush({
      token: 'join-token',
      roomName: 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
      e2eeKey: 'ephemeral-e2ee-key',
      iceServers: [{ urls: 'stun:stun.example.test:3478' }],
    });

    await expect(request).resolves.toEqual({
      token: 'join-token',
      e2eeKey: 'ephemeral-e2ee-key',
      iceServers: [{ urls: 'stun:stun.example.test:3478' }],
      degraded: false,
      degradationReason: undefined,
    });
  });

  it('binds room creation to the intended remote participant', async () => {
    const request = service.startRoom('22222222-2222-4222-8222-222222222222');

    const req = httpMock.expectOne(`${environment.apiUrl}/video-calls/start`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      remoteUserId: '22222222-2222-4222-8222-222222222222',
    });
    req.flush({
      token: 'caller-token',
      roomName: 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
      e2eeKey: 'ephemeral-e2ee-key',
    });

    const result = await request;
    expect(result.e2eeKey).toBe('ephemeral-e2ee-key');
    expect(result.degraded).toBe(false);
  });

  it('fails closed before creating a LiveKit room when the key is missing', async () => {
    const request = service.joinRoom(
      'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
      'user-123',
      false,
    );

    const req = httpMock.expectOne(`${environment.apiUrl}/video-calls/accept`);
    req.flush({
      token: 'join-token',
      roomName: 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
    });

    await expect(request).rejects.toThrow('Encrypted call key unavailable');
    expect(service.livekitConnected()).toBe(false);
    expect(service.isDegraded()).toBe(true);
  });
});
