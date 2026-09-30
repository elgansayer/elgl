import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';
import { UserProfile } from '../../services/user.service';
import { ProfileDiscoveryCardComponent } from './profile-discovery-card.component';

function makeProfile(id: string, bioText = 'Hello from my profile'): UserProfile {
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

describe('ProfileDiscoveryCardComponent bio translation', () => {
  let component: ProfileDiscoveryCardComponent;
  let fixture: ComponentFixture<ProfileDiscoveryCardComponent>;
  let currentLang: ReturnType<typeof signal<string>>;
  let translateBio: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    currentLang = signal('en-GB');
    translateBio = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ProfileDiscoveryCardComponent],
      providers: [
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
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileDiscoveryCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('profile', makeProfile('user-1'));
    fixture.detectChanges();
  });

  it('translates the current profile into the active UI language and toggles back to the original', async () => {
    translateBio.mockResolvedValue('Hola desde mi perfil');

    await component.toggleTranslation(new Event('click'));
    fixture.detectChanges();

    expect(translateBio).toHaveBeenCalledWith('user-1', 'en-GB');
    expect(component.showTranslated()).toBe(true);
    expect(component.displayBio()).toBe('Hola desde mi perfil');

    await component.toggleTranslation(new Event('click'));

    expect(component.showTranslated()).toBe(false);
    expect(component.displayBio()).toBe('Hello from my profile');
    expect(translateBio).toHaveBeenCalledTimes(1);
  });

  it('exposes translation state, target and mixed-direction text accessibly', async () => {
    translateBio.mockResolvedValue('مرحبا من ملفي الشخصي');

    const initialButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const bio = fixture.nativeElement.querySelector(`#${component.translationBioId()}`) as HTMLElement;

    expect(initialButton.getAttribute('aria-label')).toBe('profile.translateBio: Partner user-1');
    expect(initialButton.getAttribute('aria-controls')).toBe(bio.id);
    expect(initialButton.getAttribute('aria-pressed')).toBe('false');
    expect(initialButton.classList.contains('min-h-11')).toBe(true);
    expect(bio.getAttribute('dir')).toBe('auto');
    expect(bio.getAttribute('aria-live')).toBe('polite');

    await component.toggleTranslation(new Event('click'));
    fixture.detectChanges();

    const translatedButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const translatedBio = fixture.nativeElement.querySelector(
      `#${component.translationBioId()}`,
    ) as HTMLElement;
    expect(translatedButton.getAttribute('aria-pressed')).toBe('true');
    expect(translatedButton.getAttribute('aria-label')).toBe('profile.showOriginal: Partner user-1');
    expect(translatedBio.getAttribute('aria-atomic')).toBe('true');
    expect(translatedBio.textContent).toContain('مرحبا من ملفي الشخصي');
  });

  it('does not offer or request translation for a blank bio', async () => {
    fixture.componentRef.setInput('profile', makeProfile('user-1', '   '));
    fixture.detectChanges();

    expect(component.displayBio()).toBeNull();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();

    await component.toggleTranslation(new Event('click'));
    expect(translateBio).not.toHaveBeenCalled();
  });

  it('resets cached translation when the card is reused for another profile', async () => {
    translateBio.mockResolvedValue('Translated user one');
    await component.toggleTranslation(new Event('click'));

    fixture.componentRef.setInput('profile', makeProfile('user-2', 'Second profile bio'));
    fixture.detectChanges();

    expect(component.translatedBioText()).toBe('');
    expect(component.showTranslated()).toBe(false);
    expect(component.displayBio()).toBe('Second profile bio');
  });

  it('resets cached translation when the UI language changes', async () => {
    translateBio.mockResolvedValue('Translated in English');
    await component.toggleTranslation(new Event('click'));

    currentLang.set('fr');
    fixture.detectChanges();

    expect(component.translatedBioText()).toBe('');
    expect(component.showTranslated()).toBe(false);

    translateBio.mockResolvedValue('Traduit en français');
    await component.toggleTranslation(new Event('click'));

    expect(translateBio).toHaveBeenLastCalledWith('user-1', 'fr');
    expect(component.displayBio()).toBe('Traduit en français');
  });

  it('ignores a stale in-flight response after the profile changes', async () => {
    const deferred = createDeferred<string>();
    translateBio.mockReturnValue(deferred.promise);

    const action = component.toggleTranslation(new Event('click'));
    fixture.detectChanges();

    expect(component.isTranslating()).toBe(true);

    fixture.componentRef.setInput('profile', makeProfile('user-2', 'Second profile bio'));
    fixture.detectChanges();
    deferred.resolve('Stale translation');
    await action;

    expect(component.translatedBioText()).toBe('');
    expect(component.showTranslated()).toBe(false);
    expect(component.displayBio()).toBe('Second profile bio');
  });

  it('disables the action while translating and exposes an accessible retry status on failure', async () => {
    const deferred = createDeferred<string>();
    translateBio.mockReturnValue(deferred.promise);

    const action = component.toggleTranslation(new Event('click'));
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    deferred.resolve('');
    await action;
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(component.displayBio()).toBe('Hello from my profile');
    expect(component.translationErrorKey()).toBe('common.error_generic');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(status.textContent?.trim()).toBe('common.error_generic');
    expect(button.getAttribute('aria-describedby')).toBe(status.id);
  });
});
