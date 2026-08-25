import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { BlockedUsersService } from './blocked-users.service';
import { SafetyService } from './safety.service';

describe('BlockedUsersService', () => {
  let apiGet: ReturnType<typeof vi.fn>;
  let apiPost: ReturnType<typeof vi.fn>;
  let setBlockedUserLocal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn().mockResolvedValue([]);
    apiPost = vi.fn().mockResolvedValue({ success: true });
    setBlockedUserLocal = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        BlockedUsersService,
        {
          provide: ApiService,
          useValue: { get: apiGet, post: apiPost },
        },
        {
          provide: SafetyService,
          useValue: { setBlockedUserLocal },
        },
      ],
    });
  });

  it('loads blocked-user details from the authenticated Safety API and normalises target language', async () => {
    apiGet.mockResolvedValue([
      {
        id: 'user-1',
        display_name: 'Ada',
        native_language: 'en',
        target_language: 'fr',
        blocked_at: '2026-08-25T00:00:00.000Z',
      },
    ]);

    const service = TestBed.inject(BlockedUsersService);

    await vi.waitFor(() => expect(service.blockedUsers()).toHaveLength(1));

    expect(apiGet).toHaveBeenCalledWith(
      `${environment.apiUrl || ''}/safety/blocked-users-details`,
    );
    expect(service.blockedUsers()[0]).toEqual({
      id: 'user-1',
      display_name: 'Ada',
      avatar_url: undefined,
      native_language: 'en',
      target_languages: ['fr'],
      blocked_at: '2026-08-25T00:00:00.000Z',
    });
  });

  it('preserves already-loaded rows when a refresh fails', async () => {
    apiGet
      .mockResolvedValueOnce([{ id: 'user-1', display_name: 'Ada', target_language: 'fr' }])
      .mockRejectedValueOnce(new Error('offline'));

    const service = TestBed.inject(BlockedUsersService);
    await vi.waitFor(() => expect(service.blockedUsers()).toHaveLength(1));

    await service.loadBlockedUsers();

    expect(service.blockedUsers()).toHaveLength(1);
    expect(service.error()).toBe('Failed to load blocked users');
  });

  it('uses the Safety unblock endpoint, updates the shared block cache and removes the confirmed row', async () => {
    apiGet.mockResolvedValue([{ id: 'user/1', display_name: 'Ada' }]);
    const service = TestBed.inject(BlockedUsersService);
    await vi.waitFor(() => expect(service.blockedUsers()).toHaveLength(1));

    await service.unblockUser('user/1');

    expect(apiPost).toHaveBeenCalledWith(`${environment.apiUrl || ''}/safety/unblock/user%2F1`, {});
    expect(setBlockedUserLocal).toHaveBeenCalledWith('user/1', false);
    expect(service.blockedUsers()).toEqual([]);
    expect(service.error()).toBeNull();
  });

  it('keeps the user blocked and exposes an error when unblock is not confirmed', async () => {
    apiGet.mockResolvedValue([{ id: 'user-1', display_name: 'Ada' }]);
    apiPost.mockRejectedValue(new Error('network unavailable'));
    const service = TestBed.inject(BlockedUsersService);
    await vi.waitFor(() => expect(service.blockedUsers()).toHaveLength(1));

    await service.unblockUser('user-1');

    expect(service.blockedUsers()).toHaveLength(1);
    expect(service.error()).toBe('Failed to unblock user');
    expect(setBlockedUserLocal).not.toHaveBeenCalled();
  });

  it('suppresses duplicate concurrent unblock requests for the same user', async () => {
    apiGet.mockResolvedValue([{ id: 'user-1', display_name: 'Ada' }]);
    let resolveRequest!: (value: { success: boolean }) => void;
    apiPost.mockImplementation(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const service = TestBed.inject(BlockedUsersService);
    await vi.waitFor(() => expect(service.blockedUsers()).toHaveLength(1));

    const first = service.unblockUser('user-1');
    const duplicate = service.unblockUser('user-1');

    expect(apiPost).toHaveBeenCalledTimes(1);
    resolveRequest({ success: true });
    await Promise.all([first, duplicate]);

    expect(service.blockedUsers()).toEqual([]);
  });
});
