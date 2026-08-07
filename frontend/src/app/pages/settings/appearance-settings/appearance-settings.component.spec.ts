<<<<<<< HEAD
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { Pipe, PipeTransform, signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AppearanceSettingsComponent } from './appearance-settings.component';
import { FontScaleService } from '../../../services/font-scale.service';
import { Theme, ThemeService } from '../../../services/theme.service';
import { UserService } from '../../../services/user.service';
import { I18nService } from '../../../services/i18n.service';
import { TranslatePipe } from '../../../services/translate.pipe';

@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}
=======
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { AppearanceSettingsComponent } from './appearance-settings.component';
import { I18nService } from '../../../services/i18n.service';
import { FontScaleService } from '../../../services/font-scale.service';
import { ThemeService } from '../../../services/theme.service';
import { UserService } from '../../../services/user.service';
>>>>>>> origin/main

describe('AppearanceSettingsComponent', () => {
  let component: AppearanceSettingsComponent;
  let fixture: ComponentFixture<AppearanceSettingsComponent>;
<<<<<<< HEAD
  let fontScaleService: Partial<FontScaleService>;
  let setScaleSpy: Mock;
  let currentTheme: ReturnType<typeof signal<Theme>>;
  let setThemeSpy: Mock;
  let userService: { getMyProfile: Mock; updateMyProfile: Mock };
  let i18nSetLanguageSpy: Mock;
  let i18nTranslateSpy: Mock;
  let locationBackSpy: Mock;

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  beforeEach(async () => {
    const scaleSignal = signal(1.0);
    setScaleSpy = vi.fn((value: number) => scaleSignal.set(value));
    fontScaleService = { scaleFactor: scaleSignal, setScale: setScaleSpy };

    currentTheme = signal<Theme>('system');
    setThemeSpy = vi.fn((theme: Theme) => currentTheme.set(theme));

    userService = {
      getMyProfile: vi.fn().mockResolvedValue({
        is_vip: false,
        primary_accent_color: '#4f46e5',
=======
  let i18nServiceMock: Partial<I18nService>;
  let themeServiceMock: Partial<ThemeService>;
  let fontScaleServiceMock: Partial<FontScaleService>;
  let userServiceMock: Partial<UserService>;
  let locationMock: Partial<Location>;

  beforeEach(async () => {
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      translate: vi.fn((key: string) => key),
      setLanguage: vi.fn(),
      availableLanguages: [
        { code: 'en-GB', flag: '🇬🇧', nativeName: 'English', name: 'English' },
        { code: 'es', flag: '🇪🇸', nativeName: 'Español', name: 'Spanish' },
      ],
    };

    themeServiceMock = {
      currentTheme: signal<'light' | 'dark' | 'system'>('system'),
      setTheme: vi.fn(),
    };

    fontScaleServiceMock = {
      scaleFactor: signal(1.0),
      setScale: vi.fn(),
      min: 0.8,
      max: 1.2,
      step: 0.05,
    };

    userServiceMock = {
      getMyProfile: vi.fn().mockResolvedValue({
        id: '1',
        is_vip: true,
        primary_accent_color: '#4f46e5',
        native_languages: [],
        target_languages: [],
        coins_balance: 0,
        study_streak_days: 0,
        correction_ratio: 0,
        is_serious_learner: false,
        privacy_hide_age: false,
        privacy_hide_location: false,
        privacy_hide_gender: false,
        privacy_hide_from_search: false,
        is_admin: false,
        vip_tier: '',
        created_at: '',
>>>>>>> origin/main
      }),
      updateMyProfile: vi.fn().mockResolvedValue({}),
    };

<<<<<<< HEAD
    i18nSetLanguageSpy = vi.fn();
    i18nTranslateSpy = vi.fn((key: string) => key);
    locationBackSpy = vi.fn();
=======
    locationMock = {
      back: vi.fn(),
    };
>>>>>>> origin/main

    await TestBed.configureTestingModule({
      imports: [AppearanceSettingsComponent],
      providers: [
<<<<<<< HEAD
        { provide: FontScaleService, useValue: fontScaleService },
        { provide: ThemeService, useValue: { currentTheme, setTheme: setThemeSpy } },
        { provide: UserService, useValue: userService },
        {
          provide: I18nService,
          useValue: {
            currentLang: signal('en-GB'),
            availableLanguages: [
              { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧', isRtl: false },
            ],
            direction: signal('ltr'),
            setLanguage: i18nSetLanguageSpy,
            translate: i18nTranslateSpy,
          },
        },
        { provide: Location, useValue: { back: locationBackSpy } },
      ],
    })
      .overrideComponent(AppearanceSettingsComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();
=======
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: FontScaleService, useValue: fontScaleServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: Location, useValue: locationMock },
      ],
    }).compileComponents();
>>>>>>> origin/main

    fixture = TestBed.createComponent(AppearanceSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
<<<<<<< HEAD
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have theme options', () => {
    expect(component.themeOptions).toEqual(['light', 'dark', 'system']);
  });

  it('should call themeService.setTheme when setTheme is called', () => {
    component.setTheme('dark');
    expect(setThemeSpy).toHaveBeenCalledWith('dark');
  });

  it('should call i18nService.setLanguage when onLanguageChange is called', () => {
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.value = 'es';
    select.appendChild(option);
    select.value = 'es';
    const event = { target: select } as unknown as Event;
    component.onLanguageChange(event);
    expect(i18nSetLanguageSpy).toHaveBeenCalledWith('es');
  });

  it('should ignore invalid target in onLanguageChange', () => {
    const event = { target: document.createElement('div') } as unknown as Event;
    component.onLanguageChange(event);
    expect(i18nSetLanguageSpy).not.toHaveBeenCalled();
  });

  it('should call fontScaleService.setScale when onFontScaleChange is called', () => {
    const input = document.createElement('input');
    input.value = '110';
    const event = { target: input } as unknown as Event;
    component.onFontScaleChange(event);
    expect(setScaleSpy).toHaveBeenCalledWith(1.1);
  });

  it('should ignore invalid target in onFontScaleChange', () => {
    const event = { target: document.createElement('div') } as unknown as Event;
    component.onFontScaleChange(event);
    expect(setScaleSpy).not.toHaveBeenCalled();
  });

  it('should ignore NaN value in onFontScaleChange', () => {
    const input = document.createElement('input');
    input.value = 'not-a-number';
    const event = { target: input } as unknown as Event;
    component.onFontScaleChange(event);
    expect(setScaleSpy).not.toHaveBeenCalled();
  });

  it('should not set accent colour when user is not VIP', () => {
    component.setAccentColour('#e11d48');
    expect(component.selectedAccentColor()).toBe('#4f46e5');
  });

  it('should go back when goBack is called', () => {
    component.goBack();
    expect(locationBackSpy).toHaveBeenCalled();
  });

  it('should save settings successfully', async () => {
    component.selectedAccentColor.set('#9333ea');

    await component.saveSettings();

    expect(userService.updateMyProfile).toHaveBeenCalledWith({
      primary_accent_color: '#9333ea',
    });
    expect(component.successMessage()).toBe('settings.saveSuccess');
    expect(component.saving()).toBe(false);
  });

  it('should handle save errors', async () => {
    userService.updateMyProfile.mockRejectedValue(new Error('API error'));
    await component.saveSettings();
    expect(component.errorMessage()).toBe('settings.saveError');
    expect(component.saving()).toBe(false);
=======
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set the theme', () => {
    component.setTheme('dark');
    expect(themeServiceMock.setTheme).toHaveBeenCalledWith('dark');
  });

  it('should set the font scale from input event', () => {
    const event = { target: { value: '110' } } as unknown as Event;
    component.onFontScaleChange(event);
    expect(fontScaleServiceMock.setScale).toHaveBeenCalledWith(1.1);
  });

  it('should navigate back', () => {
    component.goBack();
    expect(locationMock.back).toHaveBeenCalled();
  });

  it('should change UI language', () => {
    component.changeUiLanguage('es');
    expect(i18nServiceMock.setLanguage).toHaveBeenCalledWith('es');
  });

  it('should change language from select event', () => {
    const select = document.createElement('select');
    select.value = 'es';
    Object.defineProperty(select, 'value', { value: 'es' });
    const event = { target: select } as unknown as Event;
    component.onLanguageSelect(event);
    expect(i18nServiceMock.setLanguage).toHaveBeenCalledWith('es');
  });

  it('should set accent colour when VIP', () => {
    component.isVip.set(true);
    component.setAccentColor('#e11d48');
    expect(component.primaryAccentColor()).toBe('#e11d48');
  });

  it('should not set accent colour when not VIP', () => {
    component.isVip.set(false);
    component.setAccentColor('#e11d48');
    expect(component.primaryAccentColor()).toBe('#4f46e5');
>>>>>>> origin/main
  });
});