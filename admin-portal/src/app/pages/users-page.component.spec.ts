import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
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

  it('renders a retryable search surface and clears stale results when the API fails', async () => {
    search.mockReturnValue(throwError(() => new Error('User search unavailable')));
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
    expect(component.error()).toBe('User search unavailable');

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'User search unavailable',
    );
    expect(element.querySelector('form[role="search"]')).not.toBeNull();
  });
});
