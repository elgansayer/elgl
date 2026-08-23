import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';
import { ProfileChatActionsService } from '../../services/profile-chat-actions.service';
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
    is_followed_by_me: false,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('UserDetailComponent', () => {
  let component: UserDetailComponent;
  let fixture: ComponentFixture<UserDetailComponent>;
  let currentLang: ReturnType<typeof signal<string>>;
  let translateBio: ReturnType<typeof vi.fn>;
  let getUserProfile: ReturnType<typeof vi.fn>;
  let followUser: ReturnType<typeof vi.fn>;
  let unfollowUser: ReturnType<typeof vi.fn>;
  let openDirectChat: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(async () => {
    currentLang = signal('en-GB');
    translateBio = vi.fn();
    getUserProfile = vi.fn().mockResolvedValue(makeProfile('user-1'));
    followUser = vi.fn().mockResolvedValue(undefined);
    unfollowUser = vi.fn().mockResolvedValue(undefined);
    openDirectChat = vi.fn().mockResolvedValue({ room_id: 'room-123' });

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
            likeProfile: vi.fn(),
          },
        },
        {
          provide: DiscoveryService,
          useValue: { translateBio },
        },
        {
          provide: ProfileChatActionsService,
          useValue: { openDirectChat },
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

    fixture = TestBed.createComponent(UserDetailComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.componentRef.setInput('userId', 'user-1');
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  });

  it('loads the requested profile', () => {
    expect(component).toBeTruthy();
    expect(getUserProfile).toHaveBeenCalledWith('user-1');
    expect(component.profile()?.id).toBe('user-1');
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

  it('opens an authoritative direct room before navigating', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.openChat();

    expect(openDirectChat).toHaveBeenCalledWith('user-1');
    expect(navigate).toHaveBeenCalledWith(['/chat', 'room-123']);
    expect(component.actionErrorKey()).toBe('');
  });

  it('does not navigate and exposes retry feedback when opening a chat fails', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    openDirectChat.mockRejectedValueOnce(new Error('provider unavailable'));

    await component.openChat();

    expect(navigate).not.toHaveBeenCalled();
    expect(component.actionErrorKey()).toBe('common.error_generic');
    expect(component.isOpeningChat()).toBe(false);
  });

  it('deduplicates concurrent open-chat actions', async () => {
    const deferred = createDeferred<{ room_id: string }>();
    openDirectChat.mockReturnValueOnce(deferred.promise);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const first = component.openChat();
    const second = component.openChat();
    expect(openDirectChat).toHaveBeenCalledTimes(1);

    deferred.resolve({ room_id: 'room-123' });
    await Promise.all([first, second]);
  });

  it('changes follow state only after the server confirms it', async () => {
    const deferred = createDeferred<void>();
    followUser.mockReturnValueOnce(deferred.promise);

    const action = component.toggleFollow();
    expect(component.isFollowing()).toBe(false);
    expect(component.isUpdatingFollow()).toBe(true);

    deferred.resolve(undefined);
    await action;
    expect(component.isFollowing()).toBe(true);
    expect(component.isUpdatingFollow()).toBe(false);
  });

  it('preserves follow state and exposes retry feedback when the mutation fails', async () => {
    followUser.mockRejectedValueOnce(new Error('failed'));

    await component.toggleFollow();

    expect(component.isFollowing()).toBe(false);
    expect(component.actionErrorKey()).toBe('common.error_generic');
  });

  it('uses the authoritative unfollow mutation for an existing follow', async () => {
    component.isFollowing.set(true);

    await component.toggleFollow();

    expect(unfollowUser).toHaveBeenCalledWith('user-1');
    expect(component.isFollowing()).toBe(false);
  });
});
