import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthContextService } from '../admin-auth-context.service';
import {
  AdminLoginHistoryEntry,
  AdminUserDataError,
  AdminUserDataFailure,
  AdminUserSummary,
  AdminUsersService,
} from '../admin-users.service';
import { UserDetailPageComponent } from './user-detail-page.component';

describe('UserDetailPageComponent', () => {
  const getUser = vi.fn();
  const getLoginHistory = vi.fn();
  const hasCapability = vi.fn();

  const user: AdminUserSummary = {
    id: 'user-1',
    display_name: 'Alice Example',
    avatar_url: null,
    native_languages: ['en'],
    target_languages: ['ja', 'es'],
    is_vip: true,
    vip_tier: 'gold',
    is_admin: false,
    coins_balance: 42,
    study_streak_days: 9,
    last_active_at: '2026-08-21T12:00:00.000Z',
    created_at: '2026-01-01T12:00:00.000Z',
  };

  const entry: AdminLoginHistoryEntry = {
    id: 'login-1',
    user_id: 'user-1',
    ip_address: '203.0.113.0',
    user_agent: 'ExampleBrowser/1.0',
    created_at: '2026-08-21T11:00:00.000Z',
  };

  let canReadHistory: boolean;

  beforeEach(() => {
    getUser.mockReset();
    getLoginHistory.mockReset();
    hasCapability.mockReset();
    canReadHistory = false;
    hasCapability.mockImplementation(
      (capability: string) => capability === 'users.sessions.read' && canReadHistory,
    );
  });

  async function render(
    url = '/users/user-1',
  ): Promise<{ component: UserDetailPageComponent; element: HTMLElement; refresh: () => void }> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'users/:id', component: UserDetailPageComponent },
          { path: 'users', component: UserDetailPageComponent },
        ]),
        { provide: AdminUsersService, useValue: { getUser, getLoginHistory } },
        { provide: AdminAuthContextService, useValue: { hasCapability } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url, UserDetailPageComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return {
      component,
      element: harness.routeNativeElement as HTMLElement,
      refresh: () => harness.detectChanges(),
    };
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    );
  }

  it('loads the requested user and renders minimised operational metadata', async () => {
    getUser.mockReturnValue(of(user));

    const { component, element } = await render();

    expect(getUser).toHaveBeenCalledWith('user-1');
    expect(component.user()).toEqual(user);
    expect(component.busy()).toBe(false);
    expect(element.querySelector('h3')?.textContent).toContain('Alice Example');
    for (const text of ['gold', 'Coin balance', '42', '9 days', 'en', 'ja, es']) {
      expect(element.textContent).toContain(text);
    }
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent?.trim()).toBe('');
  });

  it('does not offer or request login history without the session-read capability', async () => {
    getUser.mockReturnValue(of(user));

    const { element } = await render();

    expect(element.textContent).not.toContain('Recent login history');
    expect(button(element, 'Load login history')).toBeUndefined();
    expect(getLoginHistory).not.toHaveBeenCalled();
  });

  describe('user lookup failures', () => {
    async function renderFailing(failure: AdminUserDataFailure) {
      getUser.mockReturnValue(throwError(() => new AdminUserDataError(failure)));
      return render();
    }

    it('reports an unknown identifier as not found without offering a futile retry', async () => {
      const { component, element } = await renderFailing('not-found');

      expect(component.failure()).toBe('not-found');
      expect(component.user()).toBeNull();
      const alert = element.querySelector('[role="alert"]');
      expect(alert?.querySelector('h3')?.textContent).toContain('User not found');
      expect(alert?.textContent).toContain('No user matches this identifier.');
      expect(alert?.querySelector('a[href="/users"]')).not.toBeNull();
      expect(button(element, 'Try again')).toBeUndefined();
    });

    it('asks the operator to sign in again when the session expired', async () => {
      const { element } = await renderFailing('unauthenticated');

      const alert = element.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain(
        'Your admin session has expired. Sign in again to continue.',
      );
      expect(alert?.querySelector('a[href="/login"]')?.textContent).toContain('Sign in again');
      expect(button(element, 'Try again')).toBeUndefined();
    });

    it('explains a refused capability without a retry', async () => {
      const { element } = await renderFailing('forbidden');

      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'Your admin account is not permitted to view this user.',
      );
      expect(button(element, 'Try again')).toBeUndefined();
    });

    it('offers a retry for outages and recovers when the API returns', async () => {
      const { component, element, refresh } = await renderFailing('unavailable');

      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'User data is temporarily unavailable. Try again.',
      );
      expect(element.querySelector('a[href="/users"]')).not.toBeNull();

      getUser.mockReturnValue(of(user));
      button(element, 'Try again')?.click();
      await vi.waitFor(() => expect(component.user()).toEqual(user));
      refresh();

      expect(getUser).toHaveBeenCalledTimes(2);
      expect(component.error()).toBeNull();
      expect(component.failure()).toBeNull();
      expect(element.querySelector('[role="alert"]')).toBeNull();
      expect(element.querySelector('h3')?.textContent).toContain('Alice Example');
    });

    it('never renders provider text that reaches the page from an unexpected failure', async () => {
      getUser.mockReturnValue(
        throwError(() => new Error('postgres://operator:secret@internal.example failed')),
      );

      const { component, element } = await render();

      expect(component.failure()).toBe('unavailable');
      expect(element.textContent).not.toContain('operator:secret');
      expect(element.textContent).toContain('User data is temporarily unavailable. Try again.');
    });

    it('treats a route without an identifier as not found and never calls the API', async () => {
      const { component, element } = await render('/users');

      expect(getUser).not.toHaveBeenCalled();
      expect(component.failure()).toBe('not-found');
      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'No user matches this identifier.',
      );
    });
  });

  describe('login history', () => {
    beforeEach(() => {
      canReadHistory = true;
      getUser.mockReturnValue(of(user));
    });

    it('is loaded on demand and rendered without replacing the user summary', async () => {
      getLoginHistory.mockReturnValue(of([entry]));

      const { component, element, refresh } = await render();
      expect(getLoginHistory).not.toHaveBeenCalled();

      button(element, 'Load login history')?.click();
      await vi.waitFor(() => expect(component.historyLoaded()).toBe(true));
      refresh();

      expect(getLoginHistory).toHaveBeenCalledWith('user-1');
      expect(element.textContent).toContain('203.0.113.0');
      expect(element.textContent).toContain('ExampleBrowser/1.0');
      expect(element.querySelector('h3')?.textContent).toContain('Alice Example');
      expect(button(element, 'Load login history')).toBeUndefined();
    });

    it('says so when no entries exist', async () => {
      getLoginHistory.mockReturnValue(of([]));

      const { component, element, refresh } = await render();
      button(element, 'Load login history')?.click();
      await vi.waitFor(() => expect(component.historyLoaded()).toBe(true));
      refresh();

      expect(element.textContent).toContain('No recent login-history entries were returned.');
    });

    it('keeps the user summary and offers a retry when the history lookup is unavailable', async () => {
      getLoginHistory.mockReturnValueOnce(throwError(() => new AdminUserDataError('unavailable')));

      const { component, element, refresh } = await render();
      button(element, 'Load login history')?.click();
      await vi.waitFor(() => expect(component.historyFailure()).toBe('unavailable'));
      refresh();

      expect(component.user()).toEqual(user);
      expect(element.querySelector('h3')?.textContent).toContain('Alice Example');
      expect(element.textContent).toContain('Login history is temporarily unavailable. Try again.');
      expect(element.textContent).not.toContain('No recent login-history entries were returned.');

      getLoginHistory.mockReturnValueOnce(of([entry]));
      button(element, 'Try again')?.click();
      await vi.waitFor(() => expect(component.historyLoaded()).toBe(true));
      refresh();

      expect(component.historyError()).toBeNull();
      expect(element.textContent).toContain('203.0.113.0');
      expect(element.textContent).not.toContain('temporarily unavailable');
    });

    it('stops offering history once the server refuses it', async () => {
      getLoginHistory.mockReturnValue(throwError(() => new AdminUserDataError('forbidden')));

      const { component, element, refresh } = await render();
      button(element, 'Load login history')?.click();
      await vi.waitFor(() => expect(component.historyFailure()).toBe('forbidden'));
      refresh();

      expect(element.textContent).toContain(
        'Your admin account is not permitted to view login history.',
      );
      expect(button(element, 'Try again')).toBeUndefined();
      expect(button(element, 'Load login history')).toBeUndefined();
    });

    it('points to sign-in when the session expires during the history lookup', async () => {
      getLoginHistory.mockReturnValue(throwError(() => new AdminUserDataError('unauthenticated')));

      const { component, element, refresh } = await render();
      button(element, 'Load login history')?.click();
      await vi.waitFor(() => expect(component.historyFailure()).toBe('unauthenticated'));
      refresh();

      expect(element.querySelector('[role="alert"] a[href="/login"]')).not.toBeNull();
      expect(button(element, 'Try again')).toBeUndefined();
      expect(component.user()).toEqual(user);
    });

    it('does not request history twice while a lookup is in flight', async () => {
      const pending = new Subject<AdminLoginHistoryEntry[]>();
      getLoginHistory.mockReturnValue(pending);

      const { component } = await render();
      void component.loadLoginHistory();
      void component.loadLoginHistory();

      expect(getLoginHistory).toHaveBeenCalledTimes(1);
      pending.next([entry]);
      await vi.waitFor(() => expect(component.historyLoaded()).toBe(true));
    });
  });
});
