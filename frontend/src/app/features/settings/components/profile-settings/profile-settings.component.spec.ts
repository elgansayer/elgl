import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileSettingsComponent } from './profile-settings.component';
import { SettingsService } from '../../../../core/services/settings.service';
import { UserService } from '../../../../services/user.service';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ProfileSettingsComponent', () => {
  let component: ProfileSettingsComponent;
  let fixture: ComponentFixture<ProfileSettingsComponent>;

  const mockSettingsService = {
    profileSettings: signal({
      bio: 'Test bio',
      nativeLanguage: 'English',
      targetLanguages: [{ language: 'Japanese', level: 'Beginner', jlptLevel: 'N5' }],
      displayKana: true,
      ageFilter: { min: 20, max: 30 },
      distanceRadiusKm: 25,
      matchingPreferences: { gender: 'Any', onlyVerified: false }
    }),
    settings: signal({}),
    loadSettings: vi.fn(),
    updateProfileSettings: vi.fn()
  };

  const mockUserService = {
    getMyProfile: () => Promise.resolve({
      id: 'user-1',
      display_name: 'Test User',
      native_languages: ['English'],
      target_languages: ['Japanese'],
      bio_text: 'Test bio',
      is_vip: false,
      vip_tier: 'free',
      coins_balance: 0,
      study_streak_days: 0,
      correction_ratio: 0,
      is_serious_learner: false,
      privacy_hide_age: false,
      privacy_hide_location: false,
      privacy_hide_from_search: false,
      privacy_hide_gender: false,
      profile_visibility: 'everyone',
      created_at: '2024-01-01',
    }),
    updateMyProfile: () => Promise.resolve(null),
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ProfileSettingsComponent],
      providers: [
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: UserService, useValue: mockUserService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with data from service', () => {
    expect(component.profileForm.get('bio')?.value).toBe('Test bio');
    expect(component.distanceRadius()).toBe(25);
    expect(component.targetLanguages.length).toBe(1);
  });

  it('should add a target language', () => {
    const initialLength = component.targetLanguages.length;
    component.addTargetLanguage();
    expect(component.targetLanguages.length).toBe(initialLength + 1);
  });

  it('should remove a target language', () => {
    component.addTargetLanguage();
    const lengthBeforeRemove = component.targetLanguages.length;
    component.removeTargetLanguage(0);
    expect(component.targetLanguages.length).toBe(lengthBeforeRemove - 1);
  });
});
