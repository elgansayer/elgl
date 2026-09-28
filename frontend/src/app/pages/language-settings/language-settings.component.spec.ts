import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { LanguageSettingsComponent } from './language-settings.component';

describe('LanguageSettingsComponent', () => {
  let component: LanguageSettingsComponent;
  let fixture: ComponentFixture<LanguageSettingsComponent>;
  let i18nMock: Partial<I18nService>;
  let locationMock: Pick<Location, 'back'>;

  beforeEach(async () => {
    i18nMock = {
      currentLang: signal('en-GB'),
      availableLanguages: [
        {
          code: 'en-GB',
          name: 'British English',
          nativeName: 'English (UK)',
          flag: '🇬🇧',
          isRtl: false,
        },
        { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRtl: false },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRtl: true },
      ],
      setLanguage: vi.fn().mockResolvedValue(undefined),
      translate: vi.fn((key: string) => key),
      translations: signal({}),
    };
    locationMock = { back: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LanguageSettingsComponent],
      providers: [
        provideHttpClient(),
        { provide: I18nService, useValue: i18nMock },
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

  it('changes only the UI locale through I18nService', async () => {
    await component.selectLang('es');

    expect(i18nMock.setLanguage).toHaveBeenCalledTimes(1);
    expect(i18nMock.setLanguage).toHaveBeenCalledWith('es');
  });

  it('ignores the current locale and unknown locale values', async () => {
    await component.selectLang('en-GB');
    await component.selectLang('not-a-supported-locale');

    expect(i18nMock.setLanguage).not.toHaveBeenCalled();
  });

  it('routes Spartan radio-group changes through the validated locale path', () => {
    component.onLanguageValueChange('es');
    component.onLanguageValueChange({ code: 'ar' });

    expect(i18nMock.setLanguage).toHaveBeenCalledTimes(1);
    expect(i18nMock.setLanguage).toHaveBeenCalledWith('es');
  });

  it('prevents overlapping locale changes while one is pending', async () => {
    let resolveChange: (() => void) | undefined;
    i18nMock.setLanguage = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveChange = resolve;
        }),
    );

    const pending = component.selectLang('es');
    await component.selectLang('ar');

    expect(component.isChanging()).toBe(true);
    expect(i18nMock.setLanguage).toHaveBeenCalledTimes(1);
    expect(i18nMock.setLanguage).toHaveBeenCalledWith('es');

    resolveChange?.();
    await pending;
    expect(component.isChanging()).toBe(false);
  });

  it('exposes a retryable error state when locale switching fails', async () => {
    i18nMock.setLanguage = vi.fn().mockRejectedValue(new Error('translation provider unavailable'));

    await component.selectLang('es');
    fixture.detectChanges();

    expect(component.hasError()).toBe(true);
    expect(component.isChanging()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
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
    expect(i18nMock.setLanguage).not.toHaveBeenCalled();
  });
});
