import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { signal, Pipe, PipeTransform } from '@angular/core';
import { AppearanceSettingsComponent } from './appearance-settings.component';
import { I18nService } from '../../../services/i18n.service';
import { FontScaleService } from '../../../services/font-scale.service';
import { ThemeService } from '../../../services/theme.service';
import { UserService } from '../../../services/user.service';
import { ChatSettingsService } from '../../../services/chat-settings.service';
import { TranslatePipe } from '../../../services/translate.pipe';

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
  let chatSettingsServiceMock: Partial<ChatSettingsService>;
  let locationMock: Partial<Location>;
  const textSizePreference = signal<'small' | 'normal' | 'large'>('normal');
  const chatTextSize = signal<'small' | 'medium' | 'large'>('medium');

  beforeEach(async () => {
    textSizePreference.set('normal');
    chatTextSize.set('medium');

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
      resetPrimaryAccentColor: vi.fn(),
      primaryAccentColor: signal('#4f46e5'),
      loadFromProfile: vi.fn(),
    };

    fontScaleServiceMock = {
      scaleFactor: signal(1.0),
      textSizePreference,
      chatTextSize,
      setScale: vi.fn(),
      setTextSizePreference: vi.fn((value: 'small' | 'normal' | 'large') =>
        textSizePreference.set(value),
      ),
      setChatTextSize: vi.fn((value: 'small' | 'medium' | 'large') => chatTextSize.set(value)),
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

    chatSettingsServiceMock = {
      textSize: signal<'small' | 'medium' | 'large'>('medium'),
      loadSettings: vi.fn().mockResolvedValue(true),
      updateSetting: vi.fn().mockResolvedValue(true),
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
        { provide: ChatSettingsService, useValue: chatSettingsServiceMock },
        { provide: Location, useValue: locationMock },
      ],
    })
      .overrideComponent(AppearanceSettingsComponent, {
        remove: { imports: [TranslatePipe] },
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

  it('should expose all supported theme choices', () => {
    expect(component.themeOptions).toEqual(['light', 'dark', 'system']);
  });

  it('should render font scale percent label', () => {
    fontScaleServiceMock.scaleFactor?.set(1.1);
    fixture.detectChanges();
    expect(component.fontScalePercentLabel()).toBe('110%');
  });

  it('should set the app text size independently', () => {
    component.setTextSize('large');
    expect(fontScaleServiceMock.setTextSizePreference).toHaveBeenCalledWith('large');
    expect(component.currentTextSize()).toBe('large');
    expect(component.currentChatTextSize()).toBe('medium');
  });

  it('should set the chat text size independently', () => {
    component.setChatTextSize('small');
    expect(fontScaleServiceMock.setChatTextSize).toHaveBeenCalledWith('small');
    expect(component.currentChatTextSize()).toBe('small');
    expect(component.currentTextSize()).toBe('normal');
  });

  it('should synchronise a server chat text preference without changing app text size', () => {
    expect(chatSettingsServiceMock.loadSettings).toHaveBeenCalledOnce();
    expect(fontScaleServiceMock.setChatTextSize).toHaveBeenCalledWith('medium');
    expect(component.currentTextSize()).toBe('normal');
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

  it('should load the profile accent through the theme service entitlement boundary', () => {
    expect(themeServiceMock.loadFromProfile).toHaveBeenCalledWith({
      primary_accent_color: '#4f46e5',
    });
  });

  it('should persist chat text size and update the accent on VIP save', async () => {
    component.setChatTextSize('large');
    component.primaryAccentColor.set('#e11d48');

    await component.saveSettings();

    expect(userServiceMock.updateMyProfile).toHaveBeenCalledWith({
      primary_accent_color: '#e11d48',
    });
    expect(chatSettingsServiceMock.updateSetting).toHaveBeenCalledWith('textSize', 'large');
    expect(themeServiceMock.setPrimaryAccentColor).toHaveBeenCalledWith('#e11d48');
    expect(component.successMessage()).toBe('settings.saved');
  });

  it('should not resubmit or apply a stored accent after VIP entitlement is lost', async () => {
    component.isVip.set(false);
    component.primaryAccentColor.set('#e11d48');

    await component.saveSettings();

    expect(userServiceMock.updateMyProfile).toHaveBeenCalledWith({});
    expect(chatSettingsServiceMock.updateSetting).toHaveBeenCalledWith('textSize', 'medium');
    expect(themeServiceMock.setPrimaryAccentColor).not.toHaveBeenCalledWith('#e11d48');
    expect(themeServiceMock.resetPrimaryAccentColor).toHaveBeenCalledOnce();
  });

  it('should restore the server chat size and expose a retryable error when persistence fails', async () => {
    component.setChatTextSize('large');
    chatSettingsServiceMock.textSize?.set('medium');
    vi.mocked(chatSettingsServiceMock.updateSetting!).mockResolvedValueOnce(false);

    await component.saveSettings();

    expect(fontScaleServiceMock.setChatTextSize).toHaveBeenLastCalledWith('medium');
    expect(component.currentChatTextSize()).toBe('medium');
    expect(component.errorMessage()).toBe('Failed to save settings');
    expect(component.successMessage()).toBe('');
  });

  it('should set custom colour from color input when VIP', () => {
    component.isVip.set(true);
    const input = document.createElement('input');
    input.value = '#ff6b6b';
    const event = { target: input } as unknown as Event;
    component.onCustomColorChange(event);
    expect(component.primaryAccentColor()).toBe('#ff6b6b');
  });

  it('should set custom colour from text input when VIP', () => {
    component.isVip.set(true);
    const input = document.createElement('input');
    input.value = '#c0ffee';
    const event = { target: input } as unknown as Event;
    component.onCustomColorChange(event);
    expect(component.primaryAccentColor()).toBe('#c0ffee');
  });

  it('should not set custom colour when not VIP', () => {
    component.isVip.set(false);
    component.primaryAccentColor.set('#4f46e5');
    const input = document.createElement('input');
    input.value = '#badbad';
    const event = { target: input } as unknown as Event;
    component.onCustomColorChange(event);
    expect(component.primaryAccentColor()).toBe('#4f46e5');
  });
});
