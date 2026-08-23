import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatPinsService } from './chat-pins.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('ChatPinsService', () => {
  let service: ChatPinsService;
  let httpMock: HttpTestingController;
  let getAccessToken: ReturnType<typeof vi.fn>;
  const baseUrl = `${environment.apiUrl}/chat`;

  beforeEach(() => {
    getAccessToken = vi.fn().mockReturnValue('test-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken },
        },
      ],
    });
    service = TestBed.inject(ChatPinsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('returns no pins without an authenticated session', async () => {
    getAccessToken.mockReturnValue(null);
    await expect(service.getPinnedRoomIds()).resolves.toEqual([]);
    httpMock.expectNone(`${baseUrl}/pinned-rooms`);
  });

  it('loads the authenticated users pinned room ids', async () => {
    const promise = service.getPinnedRoomIds();
    const request = httpMock.expectOne(`${baseUrl}/pinned-rooms`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush(['room-1', 'room-2']);
    await expect(promise).resolves.toEqual(['room-1', 'room-2']);
  });

  it('sets pin state with a bounded typed payload', async () => {
    const promise = service.setPinned('room-1', true);
    const request = httpMock.expectOne(`${baseUrl}/rooms/room-1/pin`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ is_pinned: true });
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ room_id: 'room-1', is_pinned: true });
    await expect(promise).resolves.toEqual({ room_id: 'room-1', is_pinned: true });
  });
});
