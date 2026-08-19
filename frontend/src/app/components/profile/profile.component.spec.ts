import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { vi } from 'vitest';
import { ProfileComponent } from './profile.component';
import { UserService, UserProfile } from '../../services/user.service';
import { I18nService } from '../../services/i18n.service';
import { SafetyService } from '../../services/safety.service';

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let mockUserService: {
    getMyProfile: ReturnType<typeof vi.fn>;
    getMyVisitors: ReturnType<typeof vi.fn>;
    updateMyProfile: ReturnType<typeof vi.fn>;
    updatePrivacySettings: ReturnType<typeof vi.fn>;
  };

  function makeProfile(partial: Partial<UserProfile> = {}): UserProfile {
    return {
      id: 'me-1',
      native_languages: ['en'],
      target_languages: ['fr'],
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
      created_at: '2024-01-01T00:00:00Z',
      followers_count: 12,
      following_count: 4,
      ...partial,
    };
  }

  beforeEach(async () => {
    mockUserService = {
      getMyProfile: vi.fn().mockResolvedValue(makeProfile()),
      getMyVisitors: vi.fn().mockResolvedValue([]),
      updateMyProfile: vi
        .fn()
        .mockImplementation((partial) => Promise.resolve(makeProfile(partial))),
      updatePrivacySettings: vi.fn().mockResolvedValue(makeProfile()),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: mockUserService },
        { provide: SafetyService, useValue: { blockedUserIdsSignal: signal(new Set()) } },
        { provide: I18nService, useValue: { translate: vi.fn((key) => key) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
  });

  it('should render followers and following counts linking to the follow lists', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('a[href*="/profile/me-1/"]'),
    );
    const hrefs = links.map((el) => el.getAttribute('href'));
    expect(hrefs).toContain('/profile/me-1/followers');
    expect(hrefs).toContain('/profile/me-1/following');
    expect(fixture.nativeElement.textContent).toContain('12');
    expect(fixture.nativeElement.textContent).toContain('4');
  });

  it('should disable the incognito visits toggle for non-VIP users', async () => {
    mockUserService.getMyProfile.mockResolvedValue(makeProfile({ is_vip: false }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.toggleEdit();
    fixture.detectChanges();

    const checkbox: HTMLElement | null = fixture.nativeElement.querySelector(
      'hlm-checkbox[name="incognitoVisits"]',
    );
    expect(checkbox).not.toBeNull();
    expect(checkbox?.hasAttribute('data-disabled')).toBe(true);
  });

  it('should enable the incognito visits toggle for VIP users and reflect its saved state', async () => {
    mockUserService.getMyProfile.mockResolvedValue(
      makeProfile({ is_vip: true, incognito_visits: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.toggleEdit();
    fixture.detectChanges();

    const checkbox: HTMLElement | null = fixture.nativeElement.querySelector(
      'hlm-checkbox[name="incognitoVisits"]',
    );
    expect(checkbox).not.toBeNull();
    expect(checkbox?.hasAttribute('data-disabled')).toBe(false);

    const checkboxDebug = fixture.debugElement.query(By.directive(HlmCheckbox));
    expect(checkboxDebug).not.toBeNull();
    expect((checkboxDebug.componentInstance as HlmCheckbox).checked()).toBe(true);
  });

  it('should not send incognito_visits=true for a non-VIP user on save', async () => {
    mockUserService.getMyProfile.mockResolvedValue(makeProfile({ is_vip: false }));
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.incognitoVisits.set(true);
    await fixture.componentInstance.saveProfile();

    expect(mockUserService.updatePrivacySettings).toHaveBeenCalledWith(
      expect.objectContaining({ incognito_visits: false }),
    );
  });

  it('should set errorMessage when loadProfile fails', async () => {
    mockUserService.getMyProfile.mockRejectedValue(new Error('Network error'));
    await fixture.componentInstance.loadProfile();
    expect(fixture.componentInstance.errorMessage()).toBe('Network error');
  });
});
