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

describe('AppearanceSettingsComponent', () => {
  let component: AppearanceSettingsComponent;
  let fixture: ComponentFixture<AppearanceSettingsComponent>;
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
      }),
      updateMyProfile: vi.fn().mockResolvedValue({}),
    };

    i18nSetLanguageSpy = vi.fn();
    i18nTranslateSpy = vi.fn((key: string) => key);
    locationBackSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [AppearanceSettingsComponent],
      providers: [
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

    fixture = TestBed.createComponent(AppearanceSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
  });
});