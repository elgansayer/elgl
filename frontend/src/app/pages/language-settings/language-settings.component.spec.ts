import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService, LanguageInfo } from '../../services/i18n.service';
import { LoggingService } from '../../services/logging.service';
import { UiLanguagePreferenceService } from '../../services/ui-language-preference.service';
import { LanguageSettingsComponent } from './language-settings.component';

describe('LanguageSettingsComponent', () => {
  let component: LanguageSettingsComponent;
  let fixture: ComponentFixture<LanguageSettingsComponent>;
  let currentLang = signal('en-GB');
  let languagePreferenceMock: Pick<
    UiLanguagePreferenceService,
    'currentLang' | 'availableLanguages' | 'changeLanguage'
  >;
  let i18nMock: Partial<I18nService>;
  let locationMock: Pick<Location, 'back'>;

  const languages: readonly LanguageInfo[] = [
    {
      code: 'en-GB',
      name: 'British English',
      nativeName: 'English (UK)',
      flag: '🇬🇧',
      isRtl: false,
    },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRtl: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRtl: true },
  ];

  beforeEach(async () => {
    currentLang = signal('en-GB');
    languagePreferenceMock = {
      currentLang,
      availableLanguages: languages,
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    };
    i18nMock = {
      currentLang,
      availableLanguages: [...languages],
      translate: vi.fn((key: string, params?: Record<string, unknown>) =>
        params ? `${key}|${JSON.stringify(params)}` : key,
      ),
      translations: signal({}),
    };
    locationMock = { back: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LanguageSettingsComponent],
      providers: [
        provideHttpClient(),
        { provide: I18nService, useValue: i18nMock },
        { provide: UiLanguagePreferenceService, useValue: languagePreferenceMock },
        { provide: Location, useValue: locationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders every available UI language without loading study-target state', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(component.langs).toHaveLength(3);
    expect(text).toContain('English (UK)');
    expect(text).toContain('Español');
    expect(text).toContain('العربية');
  });

  it('changes only the UI locale through the preference boundary', async () => {
    await component.selectLang('es');

    expect(languagePreferenceMock.changeLanguage).toHaveBeenCalledTimes(1);
    expect(languagePreferenceMock.changeLanguage).toHaveBeenCalledWith('es');
  });

  it('ignores the current locale and unknown locale values', async () => {
    await component.selectLang('en-GB');
    await component.selectLang('not-a-supported-locale');

    expect(languagePreferenceMock.changeLanguage).not.toHaveBeenCalled();
  });

  it('routes Spartan radio-group changes through the validated locale path', () => {
    component.onLanguageValueChange('es');
    component.onLanguageValueChange({ code: 'ar' });

    expect(languagePreferenceMock.changeLanguage).toHaveBeenCalledTimes(1);
    expect(languagePreferenceMock.changeLanguage).toHaveBeenCalledWith('es');
  });

  it('prevents overlapping locale changes while one is pending', async () => {
    let resolveChange: (() => void) | undefined;
    languagePreferenceMock.changeLanguage = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveChange = resolve;
        }),
    );

    const pending = component.selectLang('es');
    await component.selectLang('ar');

    expect(component.isChanging()).toBe(true);
    expect(languagePreferenceMock.changeLanguage).toHaveBeenCalledTimes(1);
    expect(languagePreferenceMock.changeLanguage).toHaveBeenCalledWith('es');

    resolveChange?.();
    await pending;
    expect(component.isChanging()).toBe(false);
  });

  it('exposes a retryable error state when locale switching fails', async () => {
    languagePreferenceMock.changeLanguage = vi
      .fn()
      .mockRejectedValue(new Error('translation provider unavailable'));

    await component.selectLang('es');
    fixture.detectChanges();

    expect(component.hasError()).toBe(true);
    expect(component.isChanging()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    languagePreferenceMock.changeLanguage = vi.fn().mockResolvedValue(undefined);
    await component.selectLang('es');
    expect(component.hasError()).toBe(false);
  });

  it('announces the applied language once through a persistent status region', async () => {
    const region = (): HTMLElement | null => fixture.nativeElement.querySelector('[role="status"]');
    expect(region()).toBeTruthy();
    expect(region()?.textContent?.trim()).toBe('');

    await component.selectLang('es');
    fixture.detectChanges();

    expect(region()?.textContent).toContain('languageSettings.uiLangChanged');
    expect(region()?.textContent).toContain('"name":"Español"');
    expect(region()?.getAttribute('aria-live')).toBe('polite');
  });

  it('clears the announcement when the next change begins and when it fails', async () => {
    await component.selectLang('es');
    currentLang.set('es');
    expect(component.changedLanguageName()).toBe('Español');

    languagePreferenceMock.changeLanguage = vi.fn().mockRejectedValue(new Error('unavailable'));
    await component.selectLang('ar');

    expect(component.changedLanguageName()).toBeNull();
    expect(component.hasError()).toBe(true);
  });

  it('shows the loading text in the status region while a change is pending', async () => {
    let resolveChange: (() => void) | undefined;
    languagePreferenceMock.changeLanguage = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveChange = resolve;
        }),
    );

    const pending = component.selectLang('es');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'common.loading',
    );
    expect(fixture.nativeElement.querySelector('main')?.getAttribute('aria-busy')).toBe('true');

    resolveChange?.();
    await pending;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('main')?.getAttribute('aria-busy')).toBeNull();
  });

  it('uses a named main landmark and one Spartan radio group for language selection', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const main = compiled.querySelector('main');
    const group = compiled.querySelector('hlm-radio-group');

    expect(main?.getAttribute('aria-labelledby')).toBe('language-settings-title');
    expect(group?.getAttribute('aria-labelledby')).toBe('interface-language-heading');
    expect(compiled.querySelectorAll('hlm-radio')).toHaveLength(3);
  });

  it('navigates back without changing language state', () => {
    component.goBack();

    expect(locationMock.back).toHaveBeenCalledTimes(1);
    expect(languagePreferenceMock.changeLanguage).not.toHaveBeenCalled();
  });
});

describe('LanguageSettingsComponent with the transactional preference service', () => {
  type LoaderBehaviour = 'loads' | 'silently-fails' | 'throws';

  const languages: readonly LanguageInfo[] = [
    {
      code: 'en-GB',
      name: 'British English',
      nativeName: 'English (UK)',
      flag: '🇬🇧',
      isRtl: false,
    },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRtl: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRtl: true },
  ];

  let behaviour: LoaderBehaviour;
  let currentLang = signal('en-GB');
  let translations = signal<Record<string, string>>({ 'common.back': 'Back' });
  let setLanguage: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<LanguageSettingsComponent>;

  const root = (): HTMLElement => fixture.nativeElement;
  const radios = (): HTMLInputElement[] =>
    Array.from(root().querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  const checkedCode = (): string | undefined => radios().find((input) => input.checked)?.value;
  const alert = (): Element | null => root().querySelector('[role="alert"]');

  async function choose(code: string): Promise<void> {
    const input = radios().find((candidate) => candidate.value === code);
    if (!input) throw new Error(`No radio for ${code}`);
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(fixture.componentInstance.isChanging()).toBe(false));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    behaviour = 'loads';
    currentLang = signal('en-GB');
    translations = signal<Record<string, string>>({ 'common.back': 'Back' });
    document.documentElement.lang = 'en-GB';
    document.documentElement.dir = 'ltr';
    window.localStorage.clear();

    setLanguage = vi.fn(async (code: string) => {
      currentLang.set(code);
      if (behaviour === 'throws') throw new Error('translation provider unavailable');
      if (behaviour === 'loads') translations.set({ 'common.back': 'Atras' });
      // 'silently-fails' mirrors the legacy loader: locale changes, dictionary does not.
    });

    await TestBed.configureTestingModule({
      imports: [LanguageSettingsComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            currentLang,
            translations,
            availableLanguages: [...languages],
            setLanguage,
            translate: (key: string, params?: Record<string, unknown>) =>
              params ? `${key}|${JSON.stringify(params)}` : key,
          },
        },
        { provide: LoggingService, useValue: { warn: vi.fn() } },
        { provide: Location, useValue: { back: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('checks the active language initially', () => {
    expect(checkedCode()).toBe('en-GB');
  });

  it('keeps the new language checked and announces it after a successful switch', async () => {
    await choose('es');

    expect(currentLang()).toBe('es');
    expect(checkedCode()).toBe('es');
    expect(alert()).toBeNull();
    expect(root().querySelector('[role="status"]')?.textContent).toContain('"name":"Español"');
  });

  it.each<LoaderBehaviour>(['silently-fails', 'throws'])(
    'shows the previous language as checked again when the loader %s',
    async (failure) => {
      behaviour = failure;

      await choose('es');

      expect(currentLang()).toBe('en-GB');
      expect(checkedCode()).toBe('en-GB');
      expect(alert()).toBeTruthy();
      expect(document.documentElement.lang).toBe('en-GB');
    },
  );

  it('lets the user retry the same language by clicking it again after a failure', async () => {
    behaviour = 'silently-fails';
    await choose('es');
    expect(checkedCode()).toBe('en-GB');
    expect(setLanguage).toHaveBeenCalledTimes(1);

    behaviour = 'loads';
    await choose('es');

    expect(setLanguage).toHaveBeenCalledTimes(2);
    expect(currentLang()).toBe('es');
    expect(checkedCode()).toBe('es');
    expect(alert()).toBeNull();
  });

  it('disables every radio while a change is pending', async () => {
    let finish: (() => void) | undefined;
    setLanguage.mockImplementation(
      (code: string) =>
        new Promise<void>((resolve) => {
          finish = () => {
            currentLang.set(code);
            translations.set({ 'common.back': 'Atras' });
            resolve();
          };
        }),
    );

    const input = radios().find((candidate) => candidate.value === 'es');
    if (!input) throw new Error('No radio for es');
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.isChanging()).toBe(true);
    expect(radios().every((radio) => radio.disabled)).toBe(true);

    finish?.();
    await vi.waitFor(() => expect(fixture.componentInstance.isChanging()).toBe(false));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(radios().every((radio) => !radio.disabled)).toBe(true);
  });

  it('follows a language change made elsewhere while the page is open', async () => {
    currentLang.set('ar');
    translations.set({ 'common.back': 'رجوع' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(checkedCode()).toBe('ar');
  });
});
