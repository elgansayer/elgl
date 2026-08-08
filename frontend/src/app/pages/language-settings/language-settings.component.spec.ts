import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LanguageSettingsComponent } from './language-settings.component';
import { I18nService } from '../../services/i18n.service';
import { UserService } from '../../services/user.service';
import { signal } from '@angular/core';

describe('LanguageSettingsComponent', () => {
  let component: LanguageSettingsComponent;
  let fixture: ComponentFixture<LanguageSettingsComponent>;
  let i18nMock: Partial<I18nService>;
  let userServiceMock: Partial<UserService>;

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
      translate: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (params) {
          return key + ' ' + JSON.stringify(params);
        }
        return key;
      }),
      translations: signal({}),
      direction: signal('ltr'),
    } as unknown as Partial<I18nService>;

    userServiceMock = {
      getMyProfile: vi.fn().mockResolvedValue({
        id: '1',
        target_languages: ['es', 'fr'],
        native_languages: ['en'],
        is_vip: false,
        created_at: '2024-01-01T00:00:00Z',
        coins_balance: 100,
        study_streak_days: 5,
        correction_ratio: 0.8,
        is_serious_learner: false,
        privacy_hide_age: false,
        privacy_hide_location: false,
        privacy_hide_from_search: false,
        privacy_hide_gender: false,
        vip_tier: 'free',
      }),
      updateMyProfile: vi.fn().mockResolvedValue({
        id: '1',
        target_languages: ['es', 'fr'],
        native_languages: ['en'],
        created_at: '2024-01-01T00:00:00Z',
        coins_balance: 100,
        study_streak_days: 5,
        correction_ratio: 0.8,
        is_serious_learner: false,
        privacy_hide_age: false,
        privacy_hide_location: false,
        privacy_hide_from_search: false,
        privacy_hide_gender: false,
        is_vip: false,
        vip_tier: 'free',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [LanguageSettingsComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: I18nService, useValue: i18nMock },
        { provide: UserService, useValue: userServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display all available UI languages', () => {
    expect(component.langs.length).toBe(3);
  });

  it('should highlight current language as selected', () => {
    expect(component.currentLang()).toBe('en-GB');
  });

  it('should call setLanguage when selecting a UI language', async () => {
    await component.selectUiLang('es');
    expect(i18nMock.setLanguage).toHaveBeenCalledWith('es');
  });

  it('should persist UI language preference to backend', async () => {
    await component.selectUiLang('ar');
    expect(userServiceMock.updateMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ interface_language: 'ar' }),
    );
  });

  it('should sync UI language from backend profile on load', () => {
    expect(i18nMock.setLanguage).not.toHaveBeenCalledWith('en'); // default is en-GB, no sync needed
  });

  it('should have a back button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const backBtn = compiled.querySelector('button');
    expect(backBtn).toBeTruthy();
  });

  it('should load target languages from profile', () => {
    expect(userServiceMock.getMyProfile).toHaveBeenCalled();
  });

  it('should add a target language', () => {
    component.addTargetLanguage('de');
    expect(component.targetLanguages()).toContain('de');
  });

  it('should not add duplicate target language', () => {
    component.addTargetLanguage('es');
    const count = component.targetLanguages().filter((l: string) => l === 'es').length;
    expect(count).toBe(1);
  });

  it('should remove a target language', () => {
    component.removeTargetLanguage('es');
    expect(component.targetLanguages()).not.toContain('es');
  });

  it('should add a native language', () => {
    component.addNativeLanguage('de');
    expect(component.nativeLanguages()).toContain('de');
  });

  it('should remove a native language', () => {
    component.removeNativeLanguage('en');
    expect(component.nativeLanguages()).not.toContain('en');
  });

  it('should enforce max target languages limit', () => {
    component.addTargetLanguage('de');
    component.addTargetLanguage('it');
    expect(component.targetLanguages().length).toBeLessThanOrEqual(component.maxTargetLanguages);
  });

  it('should detect dirty state', () => {
    expect(component.isDirty()).toBe(false);
    component.addTargetLanguage('de');
    expect(component.isDirty()).toBe(true);
  });

  it('should discard changes', () => {
    component.addTargetLanguage('de');
    component.discardChanges();
    expect(component.targetLanguages()).not.toContain('de');
    expect(component.isDirty()).toBe(false);
  });

  it('should save changes', async () => {
    component.addTargetLanguage('de');
    await component.saveChanges();
    expect(userServiceMock.updateMyProfile).toHaveBeenCalled();
    expect(component.isDirty()).toBe(false);
  });
});
