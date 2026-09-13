import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { DirectConversationService } from '../../services/direct-conversation.service';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';
import { ProfileRelationshipService } from '../../services/profile-relationship.service';
import { SafetyService } from '../../services/safety.service';
import { UserProfile, UserService } from '../../services/user.service';
import { UserDetailComponent } from './user-detail.component';

function makeProfile(partial: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'partner-1',
    display_name: 'Partner One',
    native_languages: ['ja'],
    target_languages: ['en'],
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
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('UserDetailComponent external profile actions', () => {
  let component: UserDetailComponent;
  let fixture: ComponentFixture<UserDetailComponent>;
  let getUserProfile: ReturnType<typeof vi.fn>;
  let follow: ReturnType<typeof vi.fn>;
  let unfollow: ReturnType<typeof vi.fn>;
  let openOrCreate: ReturnType<typeof vi.fn>;

  async function render(profile: UserProfile): Promise<void> {
    getUserProfile.mockResolvedValue(profile);
    fixture.componentRef.setInput('userId', profile.id);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    getUserProfile = vi.fn();
    follow = vi.fn().mockResolvedValue(undefined);
    unfollow = vi.fn().mockResolvedValue(undefined);
    openOrCreate = vi.fn().mockResolvedValue('room-123');

    await TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'current-user' }) },
        },
        {
          provide: UserService,
          useValue: {
            getUserProfile,
            likeProfile: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DirectConversationService,
          useValue: { openOrCreate },
        },
        {
          provide: ProfileRelationshipService,
          useValue: { follow, unfollow },
        },
        {
          provide: DiscoveryService,
          useValue: { translateBio: vi.fn() },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: signal('en-GB'),
            translate: (key: string) => key,
          },
        },
      ],
    })
      .overrideProvider(SafetyService, {
        useValue: {
          getBlockedUserIds: vi.fn().mockReturnValue(of([])),
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserDetailComponent);
    component = fixture.componentInstance;
  });

  it('renders direct Send Message and Follow actions for an external profile', async () => {
    await render(makeProfile());

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    const chatButton = buttons.find(
      (button) => button.textContent?.trim() === 'chatList.tapToChat',
    );
    const followButton = fixture.nativeElement.querySelector(
      'button[aria-label="userProfile.follow"]',
    ) as HTMLButtonElement | null;

    expect(chatButton).toBeDefined();
    expect(followButton).not.toBeNull();
    expect(followButton?.textContent?.trim()).toBe('userProfile.follow');
  });

  it('follows the displayed partner and updates the action state', async () => {
    await render(makeProfile({ is_followed_by_me: false }));

    await component.toggleFollow();
    fixture.detectChanges();

    expect(follow).toHaveBeenCalledTimes(1);
    expect(follow).toHaveBeenCalledWith('partner-1');
    expect(unfollow).not.toHaveBeenCalled();
    expect(component.isFollowing()).toBe(true);

    const followButton = fixture.nativeElement.querySelector(
      'button[aria-label="userProfile.following"]',
    ) as HTMLButtonElement | null;
    expect(followButton).not.toBeNull();
  });

  it('unfollows a partner when the profile is already followed', async () => {
    await render(makeProfile({ is_followed_by_me: true }));

    await component.toggleFollow();
    fixture.detectChanges();

    expect(unfollow).toHaveBeenCalledTimes(1);
    expect(unfollow).toHaveBeenCalledWith('partner-1');
    expect(follow).not.toHaveBeenCalled();
    expect(component.isFollowing()).toBe(false);
  });

  it('rolls back the follow state when the follow request fails', async () => {
    follow.mockRejectedValue(new Error('network unavailable'));
    await render(makeProfile({ is_followed_by_me: false }));

    await component.toggleFollow();
    fixture.detectChanges();

    expect(component.isFollowing()).toBe(false);
    expect(component.followErrorKey()).toBe('common.error_generic');
  });
});
