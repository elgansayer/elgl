import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { BlockedUsersService } from './blocked-users.service';

describe('BlockedUsersService', () => {
  let service: BlockedUsersService;
  let http: HttpTestingController;
  let setBlockedUserLocal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setBlockedUserLocal = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getAccessToken: () => 'session-token' } },
        { provide: SafetyService, useValue: { setBlockedUserLocal } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BlockedUsersService);
  });

  afterEach(() => {
    http.verify();
  });

  function initialRequest() {
    return http.expectOne((request) => request.url.endsWith('/blocks') && request.method === 'GET');
  }

  function flushInitial(users: unknown[] = []): void {
    initialRequest().flush(users);
  }

  it('loads blocked users using the current Supabase access token', async () => {
    const request = initialRequest();
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');

    request.flush([{ id: 'user-1', display_name: ' Ada ' }]);
    await Promise.resolve();

    expect(service.blockedUsers()).toEqual([{ id: 'user-1', display_name: 'Ada', avatar_url: undefined, native_language: undefined, target_languages: undefined }]);
    expect(service.error()).toBeNull();
    expect(service.isLoading()).toBe(false);
  });

  it('sanitises untrusted profile fields, unsafe avatars and duplicate rows', async () => {
    initialRequest().flush([
      {
        id: 'user-1',
        display_name: 'Ada',
        avatar_url: 'javascript:alert(1)',
        native_language: ' English ',
        target_languages: [' French ', 42, 'German', 'Spanish', 'Italian'],
      },
      { id: 'user-1', display_name: 'Duplicate' },
      { id: '', display_name: 'Invalid' },
      null,
    ]);
    await Promise.resolve();

    expect(service.blockedUsers()).toEqual([
      {
        id: 'user-1',
        display_name: 'Ada',
        avatar_url: undefined,
        native_language: 'English',
        target_languages: ['French', 'German', 'Spanish'],
      },
    ]);
  });

  it('retains previously loaded rows when a refresh fails', async () => {
    flushInitial([{ id: 'user-1', display_name: 'Ada' }]);
    await Promise.resolve();

    const refresh = service.loadBlockedUsers();
    http.expectOne((request) => request.url.endsWith('/blocks')).error(new ProgressEvent('error'));
    await refresh;

    expect(service.blockedUsers().map((user) => user.id)).toEqual(['user-1']);
    expect(service.error()).toBe('Failed to load blocked users');
  });

  it('removes a user only after the server confirms the unblock', async () => {
    flushInitial([{ id: 'user-1', display_name: 'Ada' }]);
    await Promise.resolve();

    const unblock = service.unblockUser('user-1');
    expect(service.isUnblocking('user-1')).toBe(true);
    const request = http.expectOne(
      (candidate) => candidate.url.endsWith('/blocks/user-1') && candidate.method === 'DELETE',
    );
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    expect(service.blockedUsers()).toHaveLength(1);

    request.flush({ success: true });
    await unblock;

    expect(service.blockedUsers()).toEqual([]);
    expect(service.isUnblocking('user-1')).toBe(false);
    expect(setBlockedUserLocal).toHaveBeenCalledWith('user-1', false);
  });

  it('keeps the blocked row and exposes a retryable failure when unblocking fails', async () => {
    flushInitial([{ id: 'user-1', display_name: 'Ada' }]);
    await Promise.resolve();

    const unblock = service.unblockUser('user-1');
    http.expectOne((request) => request.url.endsWith('/blocks/user-1')).flush(
      { success: false },
      { status: 200, statusText: 'OK' },
    );

    await expect(unblock).rejects.toThrow('Failed to unblock user');
    expect(service.blockedUsers()).toHaveLength(1);
    expect(service.unblockError()).toBe('Failed to unblock user');
    expect(setBlockedUserLocal).not.toHaveBeenCalled();
  });

  it('suppresses concurrent duplicate unblock requests', async () => {
    flushInitial([{ id: 'user-1' }]);
    await Promise.resolve();

    const first = service.unblockUser('user-1');
    const second = service.unblockUser('user-1');
    const requests = http.match(
      (request) => request.url.endsWith('/blocks/user-1') && request.method === 'DELETE',
    );
    expect(requests).toHaveLength(1);

    requests[0].flush({ success: true });
    await Promise.all([first, second]);
    expect(service.blockedUsers()).toEqual([]);
  });

  it('fails closed when there is no authenticated session', async () => {
    flushInitial();
    await Promise.resolve();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getAccessToken: () => null } },
        { provide: SafetyService, useValue: { setBlockedUserLocal: vi.fn() } },
      ],
    });
    const unauthenticatedHttp = TestBed.inject(HttpTestingController);
    const unauthenticated = TestBed.inject(BlockedUsersService);
    await Promise.resolve();

    unauthenticatedHttp.expectNone((request) => request.url.endsWith('/blocks'));
    expect(unauthenticated.error()).toBe('Failed to load blocked users');
    expect(unauthenticated.blockedUsers()).toEqual([]);
    unauthenticatedHttp.verify();
  });
});
