import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';
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
  let followUser: ReturnType<typeof vi.fn>;
  let unfollowUser: ReturnType<typeof vi.fn>;

  async function render(profile: UserProfile): Promise<void> {
    getUserProfile.mockResolvedValue(profile);
    fixture.componentRef.setInput('userId', profile.id);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    getUserProfile = vi.fn();
    followUser = vi.fn().mockResolvedValue(undefined);
    unfollowUser = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: UserService,
          useValue: {
            getUserProfile,
            followUser,
            unfollowUser,
            likeProfile: vi.fn().mockResolvedValue(undefined),
          },
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

    const chatLink = fixture.nativeElement.querySelector(
      'a[href="/chat/partner-1"]',
    ) as HTMLAnchorElement | null;
    const followButton = fixture.nativeElement.querySelector(
      'button[aria-label="userProfile.follow"]',
    ) as HTMLButtonElement | null;

    expect(chatLink).not.toBeNull();
    expect(chatLink?.textContent?.trim()).toBe('chatList.tapToChat');
    expect(followButton).not.toBeNull();
    expect(followButton?.textContent?.trim()).toBe('userProfile.follow');
  });

  it('follows the displayed partner and updates the action state', async () => {
    await render(makeProfile({ is_followed_by_me: false }));

    await component.toggleFollow();
    fixture.detectChanges();

    expect(followUser).toHaveBeenCalledTimes(1);
    expect(followUser).toHaveBeenCalledWith('partner-1');
    expect(unfollowUser).not.toHaveBeenCalled();
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

    expect(unfollowUser).toHaveBeenCalledTimes(1);
    expect(unfollowUser).toHaveBeenCalledWith('partner-1');
    expect(followUser).not.toHaveBeenCalled();
    expect(component.isFollowing()).toBe(false);
  });

  it('rolls back the follow state when the follow request fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    followUser.mockRejectedValue(new Error('network unavailable'));
    await render(makeProfile({ is_followed_by_me: false }));

    await component.toggleFollow();
    fixture.detectChanges();

    expect(component.isFollowing()).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
