import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivacySettingsComponent } from './privacy-settings.component';
import { UserService } from '../../../services/user.service';
import { SettingsService } from '../../../core/services/settings.service';
import { I18nService } from '../../../services/i18n.service';
import { signal } from '@angular/core';
import { Location } from '@angular/common';

describe('PrivacySettingsComponent', () => {
  let component: PrivacySettingsComponent;
  let fixture: ComponentFixture<PrivacySettingsComponent>;
  let userServiceMock: Partial<UserService>;
  let settingsServiceMock: Partial<SettingsService>;
  let i18nServiceMock: Partial<I18nService>;
  let locationMock: Partial<Location>;

  const mockProfile = {
    is_vip: true,
    privacy_hide_location: true,
    privacy_hide_from_search: false,
    privacy_hide_age: false,
    privacy_hide_gender: true,
    privacy_hide_exact_location: false,
    privacy_hide_online_status: true,
    privacy_hide_vip_status: false,
    incognito_visits: true,
  };

  beforeEach(async () => {
    userServiceMock = {
      getMyProfile: vi.fn().mockResolvedValue(mockProfile),
      updateMyProfile: vi.fn().mockResolvedValue(undefined),
    };
    settingsServiceMock = {
      updatePrivacySettings: vi.fn().mockResolvedValue(undefined),
    };
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      translate: vi.fn((key: string) => key),
    };
    locationMock = {
      back: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PrivacySettingsComponent],
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: SettingsService, useValue: settingsServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: Location, useValue: locationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacySettingsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load privacy settings from profile on init', async () => {
    expect(component.privacyHideLocation()).toBe(true);
    expect(component.privacyHideSearch()).toBe(false);
    expect(component.privacyHideAge()).toBe(false);
    expect(component.privacyHideGender()).toBe(true);
    expect(component.privacyHideExactLocation()).toBe(false);
    expect(component.privacyHideOnlineStatus()).toBe(true);
    expect(component.privacyHideVipStatus()).toBe(false);
    expect(component.incognitoVisits()).toBe(true);
    expect(component.isVip()).toBe(true);
  });

  it('should toggle privacy settings via signals', () => {
    expect(component.privacyHideAge()).toBe(false);
    component.privacyHideAge.set(true);
    expect(component.privacyHideAge()).toBe(true);
    component.privacyHideAge.set(false);
    expect(component.privacyHideAge()).toBe(false);
  });

  it('should save privacy settings and call services', async () => {
    component.privacyHideLocation.set(false);
    component.privacyHideAge.set(true);

    await component.saveSettings();

    expect(userServiceMock.updateMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        privacy_hide_location: false,
        privacy_hide_age: true,
      }),
    );
    expect(settingsServiceMock.updatePrivacySettings).toHaveBeenCalled();
    expect(component.successMessage()).toBe('privacy.success');
  });

  it('should show error on save failure', async () => {
    (userServiceMock.updateMyProfile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('API error'),
    );

    await component.saveSettings();

    expect(component.errorMessage()).toBe('privacy.error');
    expect(component.isSaving()).toBe(false);
  });

  it('should navigate back on goBack', () => {
    component.goBack();
    expect(locationMock.back).toHaveBeenCalled();
  });

  it('should change profile visibility via radio selection', () => {
    expect(component.profileVisibility()).toBe('Everyone');
    component.profileVisibility.set('Nobody');
    expect(component.profileVisibility()).toBe('Nobody');
  });

  it('should change image filter level', () => {
    expect(component.imageFilterLevel()).toBe('Blurred');
    component.imageFilterLevel.set('None');
    expect(component.imageFilterLevel()).toBe('None');
  });

  it('should toggle friend request settings', () => {
    expect(component.friendRequestsEveryone()).toBe(true);
    component.friendRequestsEveryone.set(false);
    expect(component.friendRequestsEveryone()).toBe(false);
  });
});