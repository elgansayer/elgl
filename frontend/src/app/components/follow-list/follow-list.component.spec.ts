import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { FollowListComponent } from './follow-list.component';
import { UserService, UserProfile } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { DirectConversationService } from '../../services/direct-conversation.service';
import { UserQuickActionsService } from '../../services/user-quick-actions.service';

describe('FollowListComponent', () => {
  let component: FollowListComponent;
  let fixture: ComponentFixture<FollowListComponent>;
  let mockUserService: {
    getFollowers: ReturnType<typeof vi.fn>;
    getFollowing: ReturnType<typeof vi.fn>;
    followUser: ReturnType<typeof vi.fn>;
    unfollowUser: ReturnType<typeof vi.fn>;
  };
  let mockConversations: { openOrCreate: ReturnType<typeof vi.fn> };

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

  function buttonWithText(text: string): HTMLButtonElement | undefined {
    const buttons = (
      fixture.nativeElement as HTMLElement
    ).querySelectorAll<HTMLButtonElement>('li button');
    return Array.from(buttons).find((button) =>
      button.textContent?.includes(text),
    );
  }

  beforeEach(async () => {
    mockUserService = {
      getFollowers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      getFollowing: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      followUser: vi.fn().mockResolvedValue(undefined),
      unfollowUser: vi.fn().mockResolvedValue(undefined),
    };
    mockConversations = {
      openOrCreate: vi.fn().mockResolvedValue('room-123'),
    };

    await TestBed.configureTestingModule({
      imports: [FollowListComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: mockUserService },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'viewer-1' }) },
        },
        { provide: DirectConversationService, useValue: mockConversations },
        UserQuickActionsService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FollowListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('userId', 'target-user');
  });

  it('loads followers by default and following when requested', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(mockUserService.getFollowers).toHaveBeenCalledWith('target-user');

    fixture.componentRef.setInput('mode', 'following');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(mockUserService.getFollowing).toHaveBeenCalledWith('target-user');
  });

  it('renders profile identity and reusable quick actions', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [
        makeUser({
          id: 'f1',
          display_name: 'Follower One',
          is_followed_by_me: false,
        }),
      ],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Follower One');
    expect(buttonWithText('Tap to chat')).toBeTruthy();
    expect(buttonWithText('Follow')).toBeTruthy();
  });

  it('hides quick actions on the signed-in user row', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'viewer-1', display_name: 'Me' })],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('li button').length).toBe(0);
  });

  it('opens the canonical direct room instead of routing with the profile id', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'f1', display_name: 'Follower One' })],
      total: 1,
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    buttonWithText('Tap to chat')!.click();
    await fixture.whenStable();

    expect(mockConversations.openOrCreate).toHaveBeenCalledWith('f1');
    expect(navigate).toHaveBeenCalledWith(['/chat', 'room-123']);
    expect(navigate).not.toHaveBeenCalledWith(['/chat', 'f1']);
  });

  it('prevents rapid duplicate message actions', async () => {
    let resolveRoom!: (roomId: string) => void;
    mockConversations.openOrCreate.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRoom = resolve;
      }),
    );
    mockUserService.getFollowers.mockResolvedValue({
      data: [makeUser({ id: 'f1', display_name: 'Follower One' })],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const messageButton = buttonWithText('Tap to chat')!;
    messageButton.click();
    messageButton.click();
    expect(mockConversations.openOrCreate).toHaveBeenCalledTimes(1);

    resolveRoom('room-123');
    await fixture.whenStable();
  });

  it('shares optimistic follow state and rolls it back on failure', async () => {
    mockUserService.getFollowers.mockResolvedValue({
      data: [
        makeUser({
          id: 'f1',
          display_name: 'Follower One',
          is_followed_by_me: false,
        }),
      ],
      total: 1,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const followButton = buttonWithText('Follow')!;
    followButton.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(mockUserService.followUser).toHaveBeenCalledWith('f1');
    expect(followButton.textContent).toContain('Unfollow');

    mockUserService.unfollowUser.mockRejectedValue(new Error('failed'));
    followButton.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(followButton.textContent).toContain('Unfollow');
    expect(fixture.nativeElement.textContent).toContain('Failed');
  });

  it('renders empty and load-error states', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No followers yet.');

    mockUserService.getFollowers.mockRejectedValue(
      new Error('Failed to fetch followers'),
    );
    fixture.componentRef.setInput('mode', 'following');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });
});
