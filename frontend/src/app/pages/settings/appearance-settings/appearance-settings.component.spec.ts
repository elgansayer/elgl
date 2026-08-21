import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { signal, Pipe, PipeTransform } from '@angular/core';
import { AppearanceSettingsComponent } from './appearance-settings.component';
import { I18nService } from '../../../services/i18n.service';
import { FontScaleService } from '../../../services/font-scale.service';
import { ThemeService } from '../../../services/theme.service';
import { UserService } from '../../../services/user.service';
import { TranslatePipe } from '../../../services/translate.pipe';

// A minimal stub pipe so we do not depend on the real I18nService translation dictionary
@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}

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
      setPrimaryAccentColor: vi.fn(),
      primaryAccentColor: signal('#4f46e5'),
      loadFromProfile: vi.fn(),
    };

    fontScaleServiceMock = {
      scaleFactor: signal(1.0),
      setScale: vi.fn(),
      min: 0.8,
      max: 1.5,
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
    })
      .overrideComponent(AppearanceSettingsComponent, {
        remove: { imports: [TranslatePipe, FontScaleService] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

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

  it('should render font scale percent label', () => {
    fontScaleServiceMock.scaleFactor?.set(1.1);
    fixture.detectChanges();
    expect(component.fontScalePercentLabel()).toBe('110%');
  });

  it('should navigate back', () => {
    component.goBack();
    expect(locationMock.back).toHaveBeenCalled();
  });

  it('should change UI language', () => {
    component.changeUiLanguage('es');
    expect(i18nServiceMock.setLanguage).toHaveBeenCalledWith('es');
  });

  it('should change language from the select value change', () => {
    component.onLanguageValueChange('es');
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

  it('should update theme service accent colour when profile loads', async () => {
    expect(themeServiceMock.setPrimaryAccentColor).toHaveBeenCalledWith('#4f46e5');
  });

  it('should update theme service accent colour on save', async () => {
    component.primaryAccentColor.set('#e11d48');
    await component.saveSettings();
    expect(themeServiceMock.setPrimaryAccentColor).toHaveBeenCalledWith('#e11d48');
  });

  it('should set custom colour from color input when VIP', () => {
    component.isVip.set(true);
    const input = document.createElement('input');
    input.value = '#ff6b6b';
    Object.defineProperty(input, 'value', { value: '#ff6b6b' });
    const event = { target: input } as unknown as Event;
    component.onCustomColorChange(event);
    expect(component.primaryAccentColor()).toBe('#ff6b6b');
  });

  it('should set custom colour from text input when VIP', () => {
    component.isVip.set(true);
    const input = document.createElement('input');
    input.value = '#c0ffee';
    Object.defineProperty(input, 'value', { value: '#c0ffee' });
    const event = { target: input } as unknown as Event;
    component.onCustomColorChange(event);
    expect(component.primaryAccentColor()).toBe('#c0ffee');
  });

  it('should not set custom colour when not VIP', () => {
    component.isVip.set(false);
    component.primaryAccentColor.set('#4f46e5');
    const input = document.createElement('input');
    input.value = '#badbad';
    Object.defineProperty(input, 'value', { value: '#badbad' });
    const event = { target: input } as unknown as Event;
    component.onCustomColorChange(event);
    expect(component.primaryAccentColor()).toBe('#4f46e5');
  });
});
