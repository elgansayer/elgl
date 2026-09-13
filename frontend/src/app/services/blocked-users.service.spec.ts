import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { BlockedUsersService } from './blocked-users.service';

class AuthServiceStub {
  getAccessToken(): string | undefined {
    return 'test-token';
  }
}

describe('BlockedUsersService', () => {
  let service: BlockedUsersService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl || ''}/blocks`;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        BlockedUsersService,
        { provide: AuthService, useClass: AuthServiceStub },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BlockedUsersService);

    const initialRequest = httpMock.expectOne(baseUrl);
    expect(initialRequest.request.method).toBe('GET');
    expect(initialRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    initialRequest.flush([]);
    await Promise.resolve();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads blocked-user details through the authenticated API', async () => {
    const loadPromise = service.loadBlockedUsers();
    const request = httpMock.expectOne(baseUrl);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([
      {
        id: 'user-1',
        display_name: 'Ada Lovelace',
        native_language: 'English',
        target_languages: ['French'],
      },
    ]);

    await loadPromise;
    expect(service.blockedUsers()).toEqual([
      {
        id: 'user-1',
        display_name: 'Ada Lovelace',
        native_language: 'English',
        target_languages: ['French'],
      },
    ]);
    expect(service.error()).toBeNull();
    expect(service.isLoading()).toBe(false);
  });

  it('distinguishes load failure from a successful empty list', async () => {
    const loadPromise = service.loadBlockedUsers();
    const request = httpMock.expectOne(baseUrl);
    request.flush('unavailable', { status: 503, statusText: 'Service Unavailable' });

    await loadPromise;
    expect(service.blockedUsers()).toEqual([]);
    expect(service.error()).toBe('Failed to load blocked users');
    expect(service.isLoading()).toBe(false);
  });

  it('removes a user only after an authenticated unblock succeeds', async () => {
    const loadPromise = service.loadBlockedUsers();
    const loadRequest = httpMock.expectOne(baseUrl);
    loadRequest.flush([{ id: 'user/1', display_name: 'Ada' }]);
    await loadPromise;

    const unblockPromise = service.unblockUser('user/1');
    expect(service.unblockingUserIds().has('user/1')).toBe(true);

    const request = httpMock.expectOne(`${baseUrl}/user%2F1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});

    await expect(unblockPromise).resolves.toBe(true);
    expect(service.blockedUsers()).toEqual([]);
    expect(service.unblockingUserIds().has('user/1')).toBe(false);
    expect(service.unblockError()).toBe(false);
  });

  it('preserves the current list and exposes an error when unblock fails', async () => {
    const loadPromise = service.loadBlockedUsers();
    const loadRequest = httpMock.expectOne(baseUrl);
    loadRequest.flush([{ id: 'user-1', display_name: 'Ada' }]);
    await loadPromise;

    const unblockPromise = service.unblockUser('user-1');
    const request = httpMock.expectOne(`${baseUrl}/user-1`);
    request.flush('failed', { status: 503, statusText: 'Service Unavailable' });

    await expect(unblockPromise).resolves.toBe(false);
    expect(service.blockedUsers()).toEqual([{ id: 'user-1', display_name: 'Ada' }]);
    expect(service.unblockError()).toBe(true);
    expect(service.unblockingUserIds().size).toBe(0);
  });

  it('suppresses duplicate concurrent unblock requests for the same user', async () => {
    const first = service.unblockUser('user-1');
    const second = service.unblockUser('user-1');

    await expect(second).resolves.toBe(false);
    const request = httpMock.expectOne(`${baseUrl}/user-1`);
    request.flush({});
    await expect(first).resolves.toBe(true);
    httpMock.expectNone(`${baseUrl}/user-1`);
  });

  it('fails closed when no authenticated access token is available', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        BlockedUsersService,
        { provide: AuthService, useValue: { getAccessToken: () => undefined } },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BlockedUsersService);
    await Promise.resolve();

    httpMock.expectNone(baseUrl);
    expect(service.error()).toBe('Failed to load blocked users');

    await expect(service.unblockUser('user-1')).resolves.toBe(false);
    httpMock.expectNone(`${baseUrl}/user-1`);
    expect(service.unblockError()).toBe(true);
  });
});
