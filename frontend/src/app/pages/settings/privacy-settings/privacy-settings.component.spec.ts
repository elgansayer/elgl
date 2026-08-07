import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { Location } from '@angular/common';
import { PrivacySettingsComponent } from './privacy-settings.component';
import { UserService } from '../../../services/user.service';
import { I18nService } from '../../../services/i18n.service';

describe('PrivacySettingsComponent', () => {
  let component: PrivacySettingsComponent;
  let fixture: ComponentFixture<PrivacySettingsComponent>;
  let userServiceMock: Partial<UserService>;
  let locationMock: Partial<Location>;

  const mockPrivacySettings = {
    privacy_hide_age: false,
    privacy_hide_location: true,
    privacy_hide_from_search: false,
    privacy_hide_gender: true,
    privacy_last_seen: 'everyone' as const,
    privacy_profile_photo: 'contacts' as const,
    privacy_about_info: 'everyone' as const,
    privacy_status: 'nobody' as const,
    privacy_hide_exact_location: false,
    privacy_hide_online_status: true,
    privacy_hide_vip_status: false,
    incognito_visits: false,
    profile_visibility: 'everyone' as const,
  };

  const mockProfile = {
    is_vip: true,
    vip_tier: 'consumer_8_ukp_10_usd',
  };

  beforeEach(async () => {
    userServiceMock = {
      getMyPrivacySettings: vi.fn().mockResolvedValue(mockPrivacySettings),
      getMyProfile: vi.fn().mockResolvedValue(mockProfile),
      updateMyProfile: vi.fn().mockResolvedValue(undefined),
    };
    locationMock = {
      back: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PrivacySettingsComponent, RouterModule.forRoot([])],
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: Location, useValue: locationMock },
        I18nService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacySettingsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load privacy settings on init and initialise signals', () => {
    expect(component.privacyHideAge()).toBe(false);
    expect(component.privacyHideLocation()).toBe(true);
    expect(component.privacyHideGender()).toBe(true);
    expect(component.privacyHideOnlineStatus()).toBe(true);
    expect(component.privacyHideSearch()).toBe(false);
    expect(component.privacyHideExactLocation()).toBe(false);
    expect(component.privacyHideVipStatus()).toBe(false);
    expect(component.privacyLastSeen()).toBe('everyone');
    expect(component.privacyProfilePhoto()).toBe('contacts');
    expect(component.privacyAboutInfo()).toBe('everyone');
    expect(component.privacyStatus()).toBe('nobody');
    expect(component.incognitoVisits()).toBe(false);
    expect(component.profileVisibility()).toBe('everyone');
    expect(component.isVip()).toBe(true);
  });

  it('should detect changes after toggling a setting', () => {
    component.privacyHideAge.set(true);
    expect(component.hasChanges()).toBe(true);
  });

  it('should set visibility levels correctly', () => {
    component.setLastSeenVisibility('nobody');
    expect(component.privacyLastSeen()).toBe('nobody');

    component.setProfilePhotoVisibility('nobody');
    expect(component.privacyProfilePhoto()).toBe('nobody');

    component.setAboutInfoVisibility('contacts');
    expect(component.privacyAboutInfo()).toBe('contacts');

    component.setStatusVisibility('everyone');
    expect(component.privacyStatus()).toBe('everyone');

    component.setProfileVisibility('hidden');
    expect(component.profileVisibility()).toBe('hidden');
  });

  it('should save privacy settings successfully', async () => {
    component.privacyHideAge.set(true);
    await component.saveSettings();

    expect(userServiceMock.updateMyProfile).toHaveBeenCalled();
    expect(component.successMessage()).toBe('privacy.success');
  });

  it('should disable save button when no changes', () => {
    expect(component.hasChanges()).toBe(false);
  });

  it('should call location.back on goBack', () => {
    component.goBack();
    expect(locationMock.back).toHaveBeenCalled();
  });

  it('should return correct visibility labels', () => {
    expect(component.visibilityLabel('everyone')).toBe('privacy.visibility.everyone');
    expect(component.visibilityLabel('contacts')).toBe('privacy.visibility.contacts');
    expect(component.visibilityLabel('nobody')).toBe('privacy.visibility.nobody');
  });
});
