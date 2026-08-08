import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivacySettingsComponent } from './privacy-settings.component';
import { UserService } from '../../../../services/user.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { signal } from '@angular/core';

describe('PrivacySettingsComponent', () => {
  let component: PrivacySettingsComponent;
  let fixture: ComponentFixture<PrivacySettingsComponent>;

  const mockUserService = {
    getMyProfile: () => Promise.resolve({
      id: 'user-1',
      display_name: 'Test',
      native_languages: ['en'],
      target_languages: ['es'],
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
    getMyPrivacySettings: () => Promise.resolve({
      privacy_hide_age: false,
      privacy_hide_location: false,
      privacy_hide_from_search: false,
      privacy_hide_gender: false,
      privacy_last_seen: 'everyone',
      privacy_profile_photo: 'everyone',
      privacy_about_info: 'everyone',
      privacy_status: 'everyone',
      privacy_hide_exact_location: false,
      privacy_hide_online_status: false,
      privacy_hide_vip_status: false,
    }),
    updatePrivacySettings: () => Promise.resolve(null),
  };

  const mockSettingsService = {
    privacySettings: signal({
      profileVisibility: 'everyone' as const,
      directMessages: {
        allowFromServerMembers: true,
        imageFilterLevel: 'Blurred' as const,
      },
    }),
    settings: signal({}),
    loadSettings: () => {},
    updatePrivacySettings: () => {},
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacySettingsComponent],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have three visibility options', () => {
    expect(component.visibilityOptions.length).toBe(3);
    expect(component.visibilityOptions.map(o => o.value)).toEqual([
      'everyone',
      'vips_only',
      'hidden',
    ]);
  });

  it('should default profileVis to everyone', () => {
    expect(component.profileVis()).toBe('everyone');
  });

  it('should change visibility via setVisibility', () => {
    component.setVisibility('vips_only');
    expect(component.profileVis()).toBe('vips_only');
  });

  it('should toggle allowDm', () => {
    const initial = component.allowDm();
    component.toggleAllowDm();
    expect(component.allowDm()).toBe(!initial);
  });

  it('should render visibility buttons in the template', () => {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('[role="radiogroup"] button');
    expect(buttons.length).toBe(3);
  });
});
