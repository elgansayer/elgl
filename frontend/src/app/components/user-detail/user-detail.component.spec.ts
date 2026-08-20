import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';
import { ProfileVisitsService } from '../../services/profile-visits.service';
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
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('UserDetailComponent', () => {
  let component: UserDetailComponent;
  let fixture: ComponentFixture<UserDetailComponent>;
  let currentLang: ReturnType<typeof signal<string>>;
  let currentUser: ReturnType<typeof signal<any>>;
  let translateBio: ReturnType<typeof vi.fn>;
  let getUserProfile: ReturnType<typeof vi.fn>;
  let recordVisit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    currentLang = signal('en-GB');
    currentUser = signal({ id: 'owner-1', is_vip: false });
    translateBio = vi.fn();
    getUserProfile = vi.fn().mockResolvedValue(makeProfile('user-1'));
    recordVisit = vi.fn().mockResolvedValue({ recorded: true, ignored: false, visit_id: 'visit-1' });

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
            followUser: vi.fn(),
            unfollowUser: vi.fn(),
            likeProfile: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: { currentUser },
        },
        {
          provide: ProfileVisitsService,
          useValue: { recordVisit },
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
    currentUser.set({ id: 'user-1', is_vip: false });

    await component.loadProfile('user-1');

    expect(recordVisit).not.toHaveBeenCalled();
  });

  it('does not let visitor-log failure break profile rendering and permits a later safe retry', async () => {
    getUserProfile.mockResolvedValue(makeProfile('user-2'));
    recordVisit.mockRejectedValueOnce(new Error('visit API unavailable'));

    await component.loadProfile('user-2');
    expect(component.profile()?.id).toBe('user-2');
    expect(component.errorMessage()).toBe('');

    recordVisit.mockResolvedValueOnce({ recorded: false, ignored: true, reason: 'duplicate' });
    await component.loadProfile('user-2');
    expect(recordVisit).toHaveBeenCalledTimes(2);
  });

  it('coalesces repeated component loads after a successful visitor-log call', async () => {
    recordVisit.mockClear();
    getUserProfile.mockResolvedValue(makeProfile('user-3'));

    await component.loadProfile('user-3');
    await component.loadProfile('user-3');

    expect(recordVisit).toHaveBeenCalledTimes(1);
    expect(recordVisit).toHaveBeenCalledWith('user-3');
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
});
