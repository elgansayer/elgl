import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { FollowListComponent } from './follow-list.component';
import { UserService, UserProfile } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

describe('FollowListComponent', () => {
  let component: FollowListComponent;
  let fixture: ComponentFixture<FollowListComponent>;
  let mockUserService: {
    getFollowers: ReturnType<typeof vi.fn>;
    getFollowing: ReturnType<typeof vi.fn>;
    followUser: ReturnType<typeof vi.fn>;
    unfollowUser: ReturnType<typeof vi.fn>;
  };

  function makeUser(partial: Partial<UserProfile>): UserProfile {
    return {
      id: 'u-1',
      native_languages: ['en'],
      target_languages: ['fr'],
      is_vip: false,
      vip_tier: 'free',
      coins_balance: 0,
      study_streak_days: 0,
      correction_ratio: 0,
      is_serious_learner: false,
      privacy_hide_age: false,
      privacy_hide_location: false,
      privacy_hide_from_search: false,
      privacy_hide_gender: false,
      created_at: '2024-01-01T00:00:00Z',
      ...partial,
    };
  }

  beforeEach(async () => {
    mockUserService = {
      getFollowers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      getFollowing: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      followUser: vi.fn().mockResolvedValue(undefined),
      unfollowUser: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [FollowListComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'viewer-1' }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FollowListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('userId', 'target-user');
  });

  it('should create and load followers by default', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component).toBeTruthy();
    expect(mockUserService.getFollowers).toHaveBeenCalledWith('target-user');
    expect(mockUserService.getFollowing).not.toHaveBeenCalled();
  });

  it('should load the following list when mode is "following"', async () => {
    fixture.componentRef.setInput('mode', 'following');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockUserService.getFollowing).toHaveBeenCalledWith('target-user');
  });

  it('should render users returned from the resource', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'f1', display_name: 'Follower One', is_followed_by_me: false })],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Follower One');
  });

  it('should show the empty state when there are no users', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No followers yet.');
  });

  it('should keep profile navigation as a native link', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'f1', display_name: 'Follower One' })],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('li a');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/profile/f1');
    expect(link.getAttribute('role')).toBeNull();
    expect(link.getAttribute('tabindex')).toBeNull();
  });

  it('should keep back and follow actions as native Spartan buttons', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'f1', display_name: 'Follower One', is_followed_by_me: false })],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const backButton: HTMLButtonElement = fixture.nativeElement.querySelector('.sticky button');
    const followButton: HTMLButtonElement = fixture.nativeElement.querySelector('li button');

    expect(backButton.type).toBe('button');
    expect(backButton.getAttribute('role')).toBeNull();
    expect(backButton.getAttribute('tabindex')).toBeNull();
    expect(followButton.type).toBe('button');
    expect(followButton.getAttribute('role')).toBeNull();
    expect(followButton.getAttribute('tabindex')).toBeNull();
    expect(followButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('should not render a follow toggle for the signed-in user\'s own row', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'viewer-1', display_name: 'Me' })],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const followButtons = fixture.nativeElement.querySelectorAll('li button');
    expect(followButtons.length).toBe(0);
  });

  it('should optimistically toggle follow state on click', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'f1', display_name: 'Follower One', is_followed_by_me: false })],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('li button');
    expect(button.textContent).toContain('Follow');

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockUserService.followUser).toHaveBeenCalledWith('f1');
    expect(button.textContent).toContain('Unfollow');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('should route an existing follow through the unfollow action', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'f1', display_name: 'Follower One', is_followed_by_me: true })],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('li button');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockUserService.unfollowUser).toHaveBeenCalledWith('f1');
    expect(mockUserService.followUser).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('should disable and mark the follow action busy while a mutation is pending', async () => {
    let resolveFollow: (() => void) | undefined;
    mockUserService.followUser.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveFollow = resolve;
      }),
    );
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'f1', display_name: 'Follower One', is_followed_by_me: false })],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('li button');
    button.click();
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    button.click();
    expect(mockUserService.followUser).toHaveBeenCalledTimes(1);

    resolveFollow?.();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBeNull();
  });

  it('should render the correct number of followers', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [
        makeUser({ id: 'f1', display_name: 'Follower One' }),
        makeUser({ id: 'f2', display_name: 'Follower Two' }),
      ],
      total: 2,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const userElements = fixture.nativeElement.querySelectorAll('li');
    expect(userElements.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Follower One');
    expect(fixture.nativeElement.textContent).toContain('Follower Two');
  });

  it('should handle errors when fetching followers', async () => {
    mockUserService.getFollowers.mockRejectedValue(new Error('Failed to fetch followers'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const errorMessage = fixture.nativeElement.querySelector('.error-message');
    expect(errorMessage.textContent).toContain('Failed to load the list. Please try again.');
  });

  it('should roll back follow state and expose an alert when a mutation fails', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'f1', display_name: 'Follower One', is_followed_by_me: false })],
      total: 1,
    });
    mockUserService.followUser.mockRejectedValue(new Error('Failed to follow user'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('li button');
    expect(button.textContent).toContain('Follow');

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockUserService.followUser).toHaveBeenCalledWith('f1');
    expect(button.textContent).toContain('Follow');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    const errorMessage: HTMLElement = fixture.nativeElement.querySelector('.error-message');
    expect(errorMessage.getAttribute('role')).toBe('alert');
    expect(errorMessage.textContent).toContain('Failed to follow user');
  });
});
