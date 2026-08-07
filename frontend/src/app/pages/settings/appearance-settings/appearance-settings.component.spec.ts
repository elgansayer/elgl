import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { AppearanceSettingsComponent } from './appearance-settings.component';
import { I18nService } from '../../../services/i18n.service';
import { FontScaleService } from '../../../services/font-scale.service';
import { ThemeService } from '../../../services/theme.service';
import { UserService } from '../../../services/user.service';

describe('AppearanceSettingsComponent', () => {
  let component: AppearanceSettingsComponent;
  let fixture: ComponentFixture<AppearanceSettingsComponent>;
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
        { code: 'en-GB', flag: '🇬🇧', nativeName: 'English', name: 'English', isRtl: false },
        { code: 'es', flag: '🇪🇸', nativeName: 'Español', name: 'Spanish', isRtl: false },
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
      }),
      updateMyProfile: vi.fn().mockResolvedValue({}),
    };

    locationMock = {
      back: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppearanceSettingsComponent],
      providers: [
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: FontScaleService, useValue: fontScaleServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: Location, useValue: locationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppearanceSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
  });
});