import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { DirectConversationService } from '../../services/direct-conversation.service';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';
import { ProfileRelationshipService } from '../../services/profile-relationship.service';
import { SafetyService } from '../../services/safety.service';
import { toastsSignal } from '../../services/toast.service';
import { UserProfile, UserService } from '../../services/user.service';
import { UserDetailComponent } from './user-detail.component';

const CURRENT_USER_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const ROOM_ID = '33333333-3333-5333-8333-333333333333';

function makeProfile(partial: Partial<UserProfile> = {}): UserProfile {
  return {
    id: PARTNER_ID,
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
  let router: Router;
  let getUserProfile: ReturnType<typeof vi.fn>;
  let follow: ReturnType<typeof vi.fn>;
  let unfollow: ReturnType<typeof vi.fn>;
  let openOrCreate: ReturnType<typeof vi.fn>;
  let blockedUserIds: WritableSignal<Set<string>>;
  let blockUserAsync: ReturnType<typeof vi.fn>;
  let unblockUserAsync: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;

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
    openOrCreate = vi.fn().mockResolvedValue(ROOM_ID);
    confirm = vi.fn().mockResolvedValue(true);
    blockedUserIds = signal<Set<string>>(new Set());
    // Mirrors the real service: the shared block cache only changes after the
    // request succeeded.
    blockUserAsync = vi.fn(async (id: string) => {
      blockedUserIds.update((ids) => new Set([...ids, id]));
      return { success: true, blocked_id: id, already_blocked: false };
    });
    unblockUserAsync = vi.fn(async (id: string) => {
      blockedUserIds.update((ids) => new Set([...ids].filter((blocked) => blocked !== id)));
      return { success: true };
    });
    toastsSignal.set([]);

    await TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: CURRENT_USER_ID }) },
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
            translate: (key: string, params?: Record<string, unknown>) =>
              params?.['name'] ? `${key}:${String(params['name'])}` : key,
          },
        },
        { provide: ConfirmService, useValue: { confirm } },
      ],
    })
      .overrideProvider(SafetyService, {
        useValue: {
          getBlockedUserIds: vi.fn().mockReturnValue(of([])),
          blockedUserIdsSignal: blockedUserIds.asReadonly(),
          blockUserAsync,
          unblockUserAsync,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserDetailComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
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

  it('does not render follow or message actions on the current users own profile', async () => {
    await render(makeProfile({ id: CURRENT_USER_ID }));

    expect(
      fixture.nativeElement.querySelector('button[aria-label="userProfile.follow"]'),
    ).toBeNull();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    expect(
      buttons.some((button) => button.textContent?.trim() === 'chatList.tapToChat'),
    ).toBe(false);
  });

  it('opens the canonical direct conversation and navigates to the returned room', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await render(makeProfile());

    await component.openConversation();

    expect(openOrCreate).toHaveBeenCalledTimes(1);
    expect(openOrCreate).toHaveBeenCalledWith(PARTNER_ID);
    expect(navigate).toHaveBeenCalledWith(['/chat', ROOM_ID]);
    expect(component.chatErrorKey()).toBe('');
    expect(component.isOpeningChat()).toBe(false);
  });

  it('keeps the profile usable and exposes retryable status when opening chat fails', async () => {
    openOrCreate.mockRejectedValue(new Error('provider unavailable'));
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await render(makeProfile());

    await component.openConversation();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect(component.chatErrorKey()).toBe('common.error_generic');
    expect(component.isOpeningChat()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
  });

  it('follows the displayed partner and updates the action state', async () => {
    await render(makeProfile({ is_followed_by_me: false }));

    await component.toggleFollow();
    fixture.detectChanges();

    expect(follow).toHaveBeenCalledTimes(1);
    expect(follow).toHaveBeenCalledWith(PARTNER_ID);
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
    expect(unfollow).toHaveBeenCalledWith(PARTNER_ID);
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

  describe('block and report', () => {
    const toastMessages = (): string[] =>
      toastsSignal().map((toast) => `${toast.type}:${toast.message}`);

    function blockButton(): HTMLButtonElement | null {
      const label = blockedUserIds().has(PARTNER_ID)
        ? 'userProfile.unblockUser'
        : 'userProfile.blockUser';
      return fixture.nativeElement.querySelector(`button[aria-label="${label}"]`);
    }

    it('offers block and report actions for an external profile', async () => {
      await render(makeProfile());

      expect(blockButton()).not.toBeNull();
      expect(blockButton()?.textContent?.trim()).toBe('userProfile.blockUser');
      expect(fixture.nativeElement.querySelector('app-report-button')).not.toBeNull();
    });

    it('offers neither action on the current users own profile', async () => {
      await render(makeProfile({ id: CURRENT_USER_ID }));

      expect(fixture.nativeElement.querySelector('button[aria-label="userProfile.blockUser"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-report-button')).toBeNull();

      await component.toggleBlock();
      expect(confirm).not.toHaveBeenCalled();
      expect(blockUserAsync).not.toHaveBeenCalled();
    });

    it('reports a personal account with personal wording and a business with business wording', async () => {
      await render(makeProfile());
      expect(component.isBusinessAccount()).toBe(false);
      expect(component.reportTargetType()).toBe('user');

      component.profile.set(makeProfile({ business_name: 'Corner Cafe Tokyo' }));
      expect(component.isBusinessAccount()).toBe(true);
      expect(component.reportTargetType()).toBe('business');
    });

    it('treats a blank business name as a personal account', async () => {
      await render(makeProfile({ business_name: '   ' }));

      expect(component.isBusinessAccount()).toBe(false);
      expect(component.reportTargetType()).toBe('user');
    });

    it('confirms with the consequences, then blocks and flips the control to unblock', async () => {
      await render(makeProfile());

      await component.toggleBlock();
      fixture.detectChanges();

      expect(confirm).toHaveBeenCalledWith('userProfile.blockConfirmUser:Partner One');
      expect(blockUserAsync).toHaveBeenCalledWith(PARTNER_ID);
      expect(component.isBlocked()).toBe(true);
      expect(blockButton()?.textContent?.trim()).toBe('userProfile.unblockUser');
      expect(toastMessages()).toEqual(['success:userProfile.blockSuccess:Partner One']);
      expect(component.blockPending()).toBe(false);
      expect(component.blockErrorKey()).toBe('');
    });

    it('uses business wording in the confirmation for a business account', async () => {
      await render(makeProfile({ display_name: '', business_name: 'Corner Cafe Tokyo' }));

      await component.toggleBlock();

      expect(confirm).toHaveBeenCalledWith('userProfile.blockConfirmBusiness:Corner Cafe Tokyo');
      expect(blockUserAsync).toHaveBeenCalledWith(PARTNER_ID);
    });

    it('does nothing when the confirmation is declined', async () => {
      confirm.mockResolvedValue(false);
      await render(makeProfile());

      await component.toggleBlock();

      expect(blockUserAsync).not.toHaveBeenCalled();
      expect(component.isBlocked()).toBe(false);
      expect(toastMessages()).toEqual([]);
    });

    it('unblocks straight away without a confirmation and restores the block control', async () => {
      blockedUserIds.set(new Set([PARTNER_ID]));
      await render(makeProfile());
      expect(component.isBlocked()).toBe(true);

      await component.toggleBlock();
      fixture.detectChanges();

      expect(confirm).not.toHaveBeenCalled();
      expect(unblockUserAsync).toHaveBeenCalledWith(PARTNER_ID);
      expect(component.isBlocked()).toBe(false);
      expect(blockButton()?.textContent?.trim()).toBe('userProfile.blockUser');
      expect(toastMessages()).toEqual(['success:userProfile.unblockSuccess:Partner One']);
    });

    it('shows a retryable error and keeps the control as it was when blocking fails', async () => {
      blockUserAsync.mockRejectedValueOnce(new Error('service unavailable'));
      await render(makeProfile());

      await component.toggleBlock();
      fixture.detectChanges();

      expect(component.isBlocked()).toBe(false);
      expect(component.blockErrorKey()).toBe('userProfile.blockError');
      expect(component.blockPending()).toBe(false);
      expect(toastMessages()).toEqual(['error:userProfile.blockError']);
      const alert = fixture.nativeElement.querySelector('p[role="alert"]');
      expect(alert?.textContent?.trim()).toBe('userProfile.blockError');

      await component.toggleBlock();
      fixture.detectChanges();
      expect(component.isBlocked()).toBe(true);
      expect(component.blockErrorKey()).toBe('');
    });

    it('ignores a second tap while the first request is still pending', async () => {
      let finish: () => void = () => undefined;
      blockUserAsync.mockImplementationOnce(
        (id: string) =>
          new Promise((resolve) => {
            finish = () => {
              blockedUserIds.update((ids) => new Set([...ids, id]));
              resolve({ success: true, blocked_id: id, already_blocked: false });
            };
          }),
      );
      await render(makeProfile());

      const first = component.toggleBlock();
      await vi.waitFor(() => expect(component.blockPending()).toBe(true));
      fixture.detectChanges();
      expect(blockButton()?.disabled).toBe(true);
      expect(blockButton()?.getAttribute('aria-busy')).toBe('true');
      expect(fixture.nativeElement.querySelector('span.sr-only[aria-live="polite"]')?.textContent).toBe(
        'userProfile.blockPending',
      );

      await component.toggleBlock();
      expect(blockUserAsync).toHaveBeenCalledTimes(1);

      finish();
      await first;
      expect(component.blockPending()).toBe(false);
    });

    it('abandons the block when the viewer navigated to a different profile while confirming', async () => {
      let answer: (value: boolean) => void = () => undefined;
      confirm.mockReturnValueOnce(
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
      );
      await render(makeProfile());

      const pending = component.toggleBlock();
      getUserProfile.mockResolvedValue(
        makeProfile({ id: '44444444-4444-4444-8444-444444444444', display_name: 'Someone Else' }),
      );
      fixture.componentRef.setInput('userId', '44444444-4444-4444-8444-444444444444');
      fixture.detectChanges();
      await fixture.whenStable();
      answer(true);
      await pending;

      expect(blockUserAsync).not.toHaveBeenCalled();
    });
  });
});
