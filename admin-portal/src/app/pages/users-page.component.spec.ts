import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { type MockInstance, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminUserDataError,
  AdminUserListResult,
  AdminUserSummary,
  AdminUsersService,
} from '../admin-users.service';
import { UsersPageComponent } from './users-page.component';

describe('UsersPageComponent', () => {
  const search = vi.fn();
  let fixture: ComponentFixture<UsersPageComponent>;
  let component: UsersPageComponent;

  const user: AdminUserSummary = {
    id: 'user-1',
    display_name: 'Alice Example',
    avatar_url: null,
    native_languages: ['en'],
    target_languages: ['ja'],
    is_vip: true,
    vip_tier: 'vip',
    is_admin: false,
    coins_balance: 42,
    study_streak_days: 9,
    last_active_at: '2026-08-21T12:00:00.000Z',
    created_at: '2026-01-01T12:00:00.000Z',
  };

  beforeEach(() => {
    search.mockReset();
  });

  async function createComponent(result: AdminUserListResult): Promise<void> {
    search.mockReturnValue(of(result));
    TestBed.configureTestingModule({
      imports: [UsersPageComponent],
      providers: [
        provideRouter([]),
        { provide: AdminUsersService, useValue: { search } },
      ],
    });
    fixture = TestBed.createComponent(UsersPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads a bounded first page and renders inspectable user metadata', async () => {
    await createComponent({ users: [user], total: 1, page: 1, pageSize: 20 });

    expect(search).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: '' });
    expect(component.users()).toEqual([user]);
    expect(component.total()).toBe(1);
    expect(component.loaded()).toBe(true);
    expect(component.busy()).toBe(false);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Alice Example');
    expect(element.textContent).toContain('Study streak');
    expect(element.textContent).toContain('9 days');
    expect(element.querySelector('form[role="search"]')).not.toBeNull();
    expect(element.querySelector('a[href="/users/user-1"]')).not.toBeNull();
  });

  it('resets to page one when a new search is submitted', async () => {
    await createComponent({ users: [user], total: 45, page: 3, pageSize: 20 });
    component.page.set(3);
    component.query = '  Bob  ';
    search.mockReturnValue(
      of({ users: [], total: 0, page: 1, pageSize: 20 } satisfies AdminUserListResult),
    );

    await component.searchUsers(true);

    expect(search).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      search: '  Bob  ',
    });
    expect(component.page()).toBe(1);
  });

  it('keeps pagination bounded and requests the next page only when available', async () => {
    await createComponent({ users: [user], total: 41, page: 1, pageSize: 20 });
    search.mockReturnValue(
      of({ users: [user], total: 41, page: 2, pageSize: 20 } satisfies AdminUserListResult),
    );

    component.nextPage();
    await fixture.whenStable();

    expect(search).toHaveBeenLastCalledWith({ page: 2, pageSize: 20, search: '' });
    expect(component.page()).toBe(2);
    expect(component.totalPages()).toBe(3);
  });

  it('renders a privacy-safe retry action and clears stale results when the API fails', async () => {
    search.mockReturnValue(
      throwError(() => new Error('postgres://operator:secret@internal.example failed')),
    );
    TestBed.configureTestingModule({
      imports: [UsersPageComponent],
      providers: [
        provideRouter([]),
        { provide: AdminUsersService, useValue: { search } },
      ],
    });
    fixture = TestBed.createComponent(UsersPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.users()).toEqual([]);
    expect(component.total()).toBe(0);
    expect(component.loaded()).toBe(true);
    expect(component.busy()).toBe(false);
    expect(component.error()).toBe('User search is temporarily unavailable. Try again.');

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'User search is temporarily unavailable. Try again.',
    );
    expect(element.textContent).not.toContain('operator:secret');
    expect(element.querySelector('button')?.textContent).not.toBeNull();
    expect(element.querySelector('form[role="search"]')).not.toBeNull();
  });

  it('retries the current page and query after a transient failure', async () => {
    await createComponent({ users: [user], total: 1, page: 1, pageSize: 20 });
    component.query = 'Alice';
    search.mockReturnValueOnce(throwError(() => new Error('unavailable')));
    await component.searchUsers();

    search.mockReturnValueOnce(
      of({ users: [user], total: 1, page: 1, pageSize: 20 } satisfies AdminUserListResult),
    );
    component.retrySearch();
    await fixture.whenStable();

    expect(search).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: 'Alice' });
    expect(component.users()).toEqual([user]);
    expect(component.error()).toBeNull();
  });

  it('renders a single link per user so link names stay unambiguous', async () => {
    await createComponent({ users: [user], total: 1, page: 1, pageSize: 20 });

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('a[href="/users/user-1"]')).toHaveLength(1);
    expect(element.textContent).not.toContain('Inspect user');
  });

  it('keeps the result summary in a status region that exists before results load', async () => {
    await createComponent({ users: [user], total: 1, page: 1, pageSize: 20 });

    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(status?.textContent).toContain('1 matching user.');
    expect(status?.textContent).toContain('Page 1.');

    search.mockReturnValue(throwError(() => new AdminUserDataError('unavailable')));
    await component.searchUsers();
    fixture.detectChanges();

    const sameStatus = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(sameStatus).toBe(status);
    expect(sameStatus?.textContent?.trim()).toBe('');
  });

  describe('failure states', () => {
    async function createFailing(failure: ConstructorParameters<typeof AdminUserDataError>[0]) {
      search.mockReturnValue(throwError(() => new AdminUserDataError(failure)));
      TestBed.configureTestingModule({
        imports: [UsersPageComponent],
        providers: [provideRouter([]), { provide: AdminUsersService, useValue: { search } }],
      });
      fixture = TestBed.createComponent(UsersPageComponent);
      component = fixture.componentInstance;
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('sends the operator back to sign-in, with no futile retry, when the session expired', async () => {
      const element = await createFailing('unauthenticated');

      expect(component.failure()).toBe('unauthenticated');
      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'Your admin session has expired. Sign in again to continue.',
      );
      expect(element.querySelector('[role="alert"] a[href="/login"]')?.textContent).toContain(
        'Sign in again',
      );
      expect(element.textContent).not.toContain('Retry search');
      expect(element.textContent).not.toContain('temporarily unavailable');
    });

    it('explains a refused capability instead of offering a retry', async () => {
      const element = await createFailing('forbidden');

      expect(component.failure()).toBe('forbidden');
      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'Your admin account is not permitted to search users.',
      );
      expect(element.querySelector('[role="alert"] a[href="/"]')).not.toBeNull();
      expect(element.textContent).not.toContain('Retry search');
    });

    it('keeps an explicit retry for outages', async () => {
      const element = await createFailing('unavailable');

      expect(component.failure()).toBe('unavailable');
      expect(element.querySelector('[role="alert"] button')?.textContent).toContain('Retry search');
      expect(element.querySelector('[role="alert"] a')).toBeNull();
    });

    it('clears the previous failure when a later search succeeds', async () => {
      await createFailing('unauthenticated');
      search.mockReturnValue(
        of({ users: [user], total: 1, page: 1, pageSize: 20 } satisfies AdminUserListResult),
      );

      await component.searchUsers(true);
      fixture.detectChanges();

      expect(component.failure()).toBeNull();
      expect(component.error()).toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('open by user ID', () => {
    const userId = '0b6f6a0e-5f1c-4c8e-9d52-0f4d5d8d9a11';
    let navigate: MockInstance<Router['navigate']>;

    beforeEach(async () => {
      await createComponent({ users: [user], total: 1, page: 1, pageSize: 20 });
      navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    });

    it('opens the investigation view for a valid ID, normalised, without searching or calling the API', async () => {
      search.mockClear();
      component.userIdQuery.set(`  ${userId.toUpperCase()}  `);

      await component.openUserById();

      expect(navigate).toHaveBeenCalledWith(['/users', userId]);
      expect(component.idError()).toBeNull();
      expect(search).not.toHaveBeenCalled();
    });

    it.each(['', '   ', 'user-1', `${userId}0`, `${userId.slice(0, -1)}g`, '../users', `${userId}/login-history`])(
      'rejects %j with a field error and does not navigate',
      async (value) => {
        component.userIdQuery.set(value);

        await component.openUserById();
        fixture.detectChanges();

        expect(navigate).not.toHaveBeenCalled();
        const element = fixture.nativeElement as HTMLElement;
        const input = element.querySelector<HTMLInputElement>('#user-id-lookup');
        expect(element.querySelector('#user-id-lookup-error')?.textContent).toContain(
          'Enter a valid user ID',
        );
        expect(element.querySelector('#user-id-lookup-error')?.getAttribute('role')).toBe('alert');
        expect(input?.getAttribute('aria-invalid')).toBe('true');
        expect(input?.getAttribute('aria-describedby')).toBe('user-id-lookup-error');
      },
    );

    it('clears a previous validation error once a valid ID is submitted', async () => {
      component.userIdQuery.set('nope');
      await component.openUserById();
      expect(component.idError()).not.toBeNull();

      component.userIdQuery.set(userId);
      await component.openUserById();
      fixture.detectChanges();

      expect(component.idError()).toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('#user-id-lookup-error')).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/users', userId]);
    });

    it('exposes a labelled ID field that is separate from the display-name search', () => {
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('label[for="user-id-lookup"]')?.textContent).toContain('User ID');
      expect(element.querySelector('label[for="user-search"]')?.textContent).toContain('Display name');
      expect(element.querySelectorAll('form')).toHaveLength(2);
    });
  });
});
