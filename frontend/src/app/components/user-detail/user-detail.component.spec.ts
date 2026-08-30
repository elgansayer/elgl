import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { DirectConversationService } from '../../services/direct-conversation.service';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';
import { ProfileVisitsService } from '../../services/profile-visits.service';
import { ProfileRelationshipService } from '../../services/profile-relationship.service';
import { SafetyService } from '../../services/safety.service';
import { UserProfile, UserService } from '../../services/user.service';
import { UserDetailComponent } from './user-detail.component';

function makeProfile(id: string, bioText = 'Original profile bio'): UserProfile {
  return {
    id,
    display_name: `Partner ${id}`,
    native_languages: ['en'],
    target_languages: ['es'],
    bio_text: bioText,
    is_vip: false,
    vip_tier: '',
    coins_balance: 0,
    study_streak_days: 0,
    correction_ratio: 0,
    is_serious_learner: false,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    privacy_hide_gender: false,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver;
    reject = rejecter;
  });
  return { promise, resolve, reject };
}

describe('UserDetailComponent', () => {
  let component: UserDetailComponent;
  let fixture: ComponentFixture<UserDetailComponent>;
  let currentLang: ReturnType<typeof signal<string>>;
  let currentUser: ReturnType<typeof signal<{ id: string } | null>>;
  let translateBio: ReturnType<typeof vi.fn>;
  let getUserProfile: ReturnType<typeof vi.fn>;
  let recordVisit: ReturnType<typeof vi.fn>;
  let openOrCreate: ReturnType<typeof vi.fn>;
  let follow: ReturnType<typeof vi.fn>;
  let unfollow: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    currentLang = signal('en-GB');
    currentUser = signal<{ id: string } | null>({ id: 'current-user' });
    translateBio = vi.fn();
    getUserProfile = vi.fn().mockResolvedValue(makeProfile('user-1'));
    recordVisit = vi
      .fn()
      .mockResolvedValue({ recorded: true, ignored: false, visit_id: 'visit-1' });
    openOrCreate = vi.fn().mockResolvedValue('room-123');
    follow = vi.fn().mockResolvedValue(undefined);
    unfollow = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser },
        },
        {
          provide: UserService,
          useValue: {
            getUserProfile,
            likeProfile: vi.fn(),
          },
        },
        {
          provide: ProfileVisitsService,
          useValue: { recordVisit },
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
          useValue: { translateBio },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang,
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

    const router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(UserDetailComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('userId', 'user-1');
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  });

  it('loads the requested profile and records the successful external profile view', () => {
    expect(component).toBeTruthy();
    expect(getUserProfile).toHaveBeenCalledWith('user-1');
    expect(component.profile()?.id).toBe('user-1');
    expect(recordVisit).toHaveBeenCalledWith('user-1');
  });

  it('does not record a self view', async () => {
    recordVisit.mockClear();
    currentUser.set({ id: 'user-1' });

    await component.loadProfile('user-1');

    expect(recordVisit).not.toHaveBeenCalled();
  });

  it('does not let visitor-log failure break profile rendering and permits a later safe retry', async () => {
    recordVisit.mockClear();
    getUserProfile.mockResolvedValue(makeProfile('user-2'));
    recordVisit.mockRejectedValueOnce(new Error('visit API unavailable'));

    fixture.componentRef.setInput('userId', 'user-2');
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    expect(component.profile()?.id).toBe('user-2');
    expect(component.errorMessage()).toBe('');

    recordVisit.mockResolvedValueOnce({ recorded: false, ignored: true, reason: 'duplicate' });
    await component.loadProfile('user-2');
    expect(recordVisit).toHaveBeenCalledTimes(2);
  });

  it('coalesces repeated component loads after a successful visitor-log call', async () => {
    recordVisit.mockClear();
    getUserProfile.mockResolvedValue(makeProfile('user-3'));

    fixture.componentRef.setInput('userId', 'user-3');
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    await component.loadProfile('user-3');

    expect(recordVisit).toHaveBeenCalledTimes(1);
    expect(recordVisit).toHaveBeenCalledWith('user-3');
  });

  it('ignores a stale profile response after the route target changes', async () => {
    const stale = createDeferred<UserProfile | null>();
    getUserProfile.mockReturnValueOnce(stale.promise);
    getUserProfile.mockResolvedValueOnce(makeProfile('user-fast'));

    fixture.componentRef.setInput('userId', 'user-slow');
    fixture.detectChanges();
    fixture.componentRef.setInput('userId', 'user-fast');
    fixture.detectChanges();
    await Promise.resolve();

    stale.resolve(makeProfile('user-slow'));
    await stale.promise;
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.profile()?.id).toBe('user-fast');
    expect(component.isLoading()).toBe(false);
  });

  it('translates into the active UI language and can show the original again', async () => {
    translateBio.mockResolvedValue('Biografía traducida');

    await component.toggleTranslation();
    fixture.detectChanges();

    expect(translateBio).toHaveBeenCalledWith('user-1', 'en-GB');
    expect(component.showTranslated()).toBe(true);
    expect(component.displayBio).toBe('Biografía traducida');

    await component.toggleTranslation();

    expect(component.showTranslated()).toBe(false);
    expect(component.displayBio).toBe('Original profile bio');
    expect(translateBio).toHaveBeenCalledTimes(1);
  });

  it('resets cached translation when the UI language changes', async () => {
    translateBio.mockResolvedValue('Translated in English');
    await component.toggleTranslation();

    currentLang.set('fr');
    fixture.detectChanges();

    expect(component.translatedBioText()).toBe('');
    expect(component.showTranslated()).toBe(false);

    translateBio.mockResolvedValue('Traduit en français');
    await component.toggleTranslation();

    expect(translateBio).toHaveBeenLastCalledWith('user-1', 'fr');
    expect(component.displayBio).toBe('Traduit en français');
  });

  it('invalidates cached and in-flight translation when navigating to another profile', async () => {
    const deferred = createDeferred<string>();
    translateBio.mockReturnValue(deferred.promise);
    getUserProfile.mockResolvedValueOnce(makeProfile('user-2', 'Second profile bio'));

    const action = component.toggleTranslation();
    fixture.detectChanges();
    expect(component.isTranslating()).toBe(true);

    fixture.componentRef.setInput('userId', 'user-2');
    fixture.detectChanges();
    deferred.resolve('Stale user-one translation');
    await action;
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.translatedBioText()).toBe('');
    expect(component.showTranslated()).toBe(false);
    expect(component.profile()?.id).toBe('user-2');
    expect(component.displayBio).toBe('Second profile bio');
  });

  it('preserves the original bio and exposes accessible retry feedback when translation fails', async () => {
    translateBio.mockResolvedValue('');

    await component.toggleTranslation();
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    const translationButton = fixture.nativeElement.querySelector(
      `button[aria-describedby="${component.translationStatusId()}"]`,
    ) as HTMLButtonElement;

    expect(component.displayBio).toBe('Original profile bio');
    expect(component.showTranslated()).toBe(false);
    expect(component.translationErrorKey()).toBe('common.error_generic');
    expect(status.textContent?.trim()).toBe('common.error_generic');
    expect(translationButton.disabled).toBe(false);
    expect(translationButton.getAttribute('aria-busy')).toBeNull();
  });

  it('disables the translation action while a request is in flight', async () => {
    const deferred = createDeferred<string>();
    translateBio.mockReturnValue(deferred.promise);

    const action = component.toggleTranslation();
    fixture.detectChanges();

    const busyButton = fixture.nativeElement.querySelector(
      'button[aria-busy="true"]',
    ) as HTMLButtonElement;
    expect(busyButton.disabled).toBe(true);

    deferred.resolve('Translated bio');
    await action;
    fixture.detectChanges();

    expect(component.isTranslating()).toBe(false);
    expect(component.displayBio).toBe('Translated bio');
  });

  it('opens or creates the direct room before navigating to chat', async () => {
    await component.openConversation();

    expect(openOrCreate).toHaveBeenCalledWith('user-1');
    expect(navigate).toHaveBeenCalledWith(['/chat', 'room-123']);
    expect(component.chatErrorKey()).toBe('');
  });

  it('prevents duplicate direct-chat requests while one is pending', async () => {
    const deferred = createDeferred<string>();
    openOrCreate.mockReturnValue(deferred.promise);

    const first = component.openConversation();
    const second = component.openConversation();

    expect(openOrCreate).toHaveBeenCalledTimes(1);
    expect(component.isOpeningChat()).toBe(true);

    deferred.resolve('room-456');
    await Promise.all([first, second]);

    expect(navigate).toHaveBeenCalledWith(['/chat', 'room-456']);
    expect(component.isOpeningChat()).toBe(false);
  });

  it('shows a retryable status when direct-chat creation fails', async () => {
    openOrCreate.mockRejectedValue(new Error('blocked'));

    await component.openConversation();
    fixture.detectChanges();

    expect(component.chatErrorKey()).toBe('common.error_generic');
    expect(component.isOpeningChat()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    const status = fixture.nativeElement.querySelector(
      `#${component.chatStatusId()}`,
    ) as HTMLElement;
    expect(status.getAttribute('role')).toBe('status');
  });

  it('rolls back an optimistic follow when the request fails', async () => {
    follow.mockRejectedValue(new Error('network failure'));

    await component.toggleFollow();
    fixture.detectChanges();

    expect(component.isFollowing()).toBe(false);
    expect(component.followErrorKey()).toBe('common.error_generic');
    expect(component.isFollowingPending()).toBe(false);
  });

  it('prevents duplicate follow requests while the first is pending', async () => {
    const deferred = createDeferred<void>();
    follow.mockReturnValue(deferred.promise);

    const first = component.toggleFollow();
    const second = component.toggleFollow();

    expect(follow).toHaveBeenCalledTimes(1);
    expect(component.isFollowingPending()).toBe(true);

    deferred.resolve();
    await Promise.all([first, second]);
    expect(component.isFollowing()).toBe(true);
  });

  it('suppresses profile actions for the current user', async () => {
    currentUser.set({ id: 'user-1' });
    fixture.detectChanges();

    expect(component.isOwnProfile()).toBe(true);
    await component.openConversation();
    await component.toggleFollow();

    expect(openOrCreate).not.toHaveBeenCalled();
    expect(follow).not.toHaveBeenCalled();
    expect(unfollow).not.toHaveBeenCalled();
  });
});
