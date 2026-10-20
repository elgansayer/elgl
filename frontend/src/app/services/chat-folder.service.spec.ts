import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatFolderService } from './chat-folder.service';

const baseUrl = `${environment.apiUrl}/chat/folders`;

describe('ChatFolderService', () => {
  let service: ChatFolderService;
  let httpMock: HttpTestingController;
  const getAccessToken = vi.fn();

  beforeEach(() => {
    getAccessToken.mockReturnValue('test-token');
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
    service = TestBed.inject(ChatFolderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.clearAllMocks();
  });

  it('loads archived rooms with authentication', async () => {
    const promise = service.getArchivedRooms();
    const request = httpMock.expectOne(`${baseUrl}/archived`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([
      {
        id: 'room-1',
        title: 'Archived',
        subtitle: '',
        avatar: '',
        is_online: false,
        is_pinned: false,
        created_at: '2026-08-23T00:00:00.000Z',
      },
    ]);
    await expect(promise).resolves.toHaveLength(1);
  });

  it('loads hidden room details only through the explicit hidden-folder endpoint', async () => {
    const promise = service.getHiddenRooms();
    const request = httpMock.expectOne(`${baseUrl}/hidden`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([]);
    await expect(promise).resolves.toEqual([]);
  });

  it('archives and unarchives a room using idempotent desired-state endpoints', async () => {
    const roomId = '11111111-1111-4111-8111-111111111111';

    const archivePromise = service.archiveRoom(roomId);
    const archiveRequest = httpMock.expectOne(`${baseUrl}/archived/${roomId}`);
    expect(archiveRequest.request.method).toBe('POST');
    expect(archiveRequest.request.body).toEqual({});
    archiveRequest.flush({ success: true });
    await archivePromise;

    const unarchivePromise = service.unarchiveRoom(roomId);
    const unarchiveRequest = httpMock.expectOne(`${baseUrl}/archived/${roomId}`);
    expect(unarchiveRequest.request.method).toBe('DELETE');
    unarchiveRequest.flush({ success: true });
    await unarchivePromise;
  });

  it('does not issue folder reads without an authenticated session', async () => {
    getAccessToken.mockReturnValue(null);
    await expect(service.getArchivedRooms()).resolves.toEqual([]);
    await expect(service.getHiddenRooms()).resolves.toEqual([]);
    httpMock.expectNone(`${baseUrl}/archived`);
    httpMock.expectNone(`${baseUrl}/hidden`);
  });

  it('propagates failed mutations so UI state is not changed optimistically', async () => {
    const roomId = '11111111-1111-4111-8111-111111111111';
    const promise = service.archiveRoom(roomId);
    const request = httpMock.expectOne(`${baseUrl}/archived/${roomId}`);
    request.flush({ message: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    await expect(promise).rejects.toBeTruthy();
  });
});
