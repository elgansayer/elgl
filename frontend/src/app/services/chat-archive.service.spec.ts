import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatArchiveService } from './chat-archive.service';

const roomId = '22222222-2222-4222-8222-222222222222';
const secondRoomId = '33333333-3333-4333-8333-333333333333';
const baseUrl = `${environment.apiUrl}/chat`;

describe('ChatArchiveService', () => {
  let service: ChatArchiveService;
  let httpMock: HttpTestingController;
  let getAccessToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getAccessToken = vi.fn().mockReturnValue('test-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken } as unknown as AuthService,
        },
      ],
    });
    service = TestBed.inject(ChatArchiveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('does not probe private archive state while signed out', async () => {
    getAccessToken.mockReturnValue(null);

    await expect(service.getArchivedRoomIds()).resolves.toEqual([]);
    httpMock.expectNone(`${baseUrl}/archived-rooms`);
  });

  it('loads validated per-user archived room ids', async () => {
    const promise = service.getArchivedRoomIds();
    const request = httpMock.expectOne(`${baseUrl}/archived-rooms`);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([roomId, secondRoomId]);

    await expect(promise).resolves.toEqual([roomId, secondRoomId]);
  });

  it('fails closed on malformed or duplicated archive state', async () => {
    const promise = service.getArchivedRoomIds();
    httpMock.expectOne(`${baseUrl}/archived-rooms`).flush([roomId, roomId]);

    await expect(promise).rejects.toThrow('Invalid archived chats response');
  });

  it('archives a room through the authenticated endpoint', async () => {
    const promise = service.archiveRoom(roomId);
    const request = httpMock.expectOne(`${baseUrl}/rooms/${roomId}/archive`);

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ success: true });

    await expect(promise).resolves.toBeUndefined();
  });

  it('restores a room through the authenticated endpoint', async () => {
    const promise = service.unarchiveRoom(roomId);
    const request = httpMock.expectOne(`${baseUrl}/rooms/${roomId}/unarchive`);
    request.flush({ success: true });

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects invalid room ids before network access', async () => {
    await expect(service.archiveRoom('not-a-room-id')).rejects.toThrow(
      'Invalid chat room identifier',
    );
  });

  it('rejects archive writes without an authenticated session', async () => {
    getAccessToken.mockReturnValue(null);

    await expect(service.archiveRoom(roomId)).rejects.toThrow('Authentication required');
    httpMock.expectNone(`${baseUrl}/rooms/${roomId}/archive`);
  });

  it('rejects malformed mutation acknowledgements', async () => {
    const promise = service.archiveRoom(roomId);
    httpMock.expectOne(`${baseUrl}/rooms/${roomId}/archive`).flush({ success: false });

    await expect(promise).rejects.toThrow('Invalid chat archive response');
  });
});
