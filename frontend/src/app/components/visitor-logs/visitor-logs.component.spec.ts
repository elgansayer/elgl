import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VisitorLogsComponent } from './visitor-logs.component';
import { UserService, VisitorLog, UserProfile } from '../../services/user.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { DatePipe } from '@angular/common';
import { provideRouter } from '@angular/router';

describe.skip('VisitorLogsComponent', () => {
  let component: VisitorLogsComponent;
  let fixture: ComponentFixture<VisitorLogsComponent>;
  let userService: { getMyProfile: ReturnType<typeof vi.fn>; getMyVisitors: ReturnType<typeof vi.fn> };
  let i18nService: { translate: ReturnType<typeof vi.fn> };

  const mockProfile: UserProfile = {
    id: 'user-1',
    display_name: 'Test User',
    native_languages: ['en'],
    target_languages: ['es'],
    is_vip: false,
    vip_tier: 'free',
    coins_balance: 0,
    study_streak_days: 1,
    correction_ratio: 1,
    is_serious_learner: false,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    privacy_hide_gender: false,
    created_at: new Date().toISOString(),
  };

  const mockVisitors: VisitorLog[] = [
    {
      id: 'visit-1',
      created_at: new Date().toISOString(),
      is_blurred: false,
      visitor: {
        id: 'v-1',
        display_name: 'Alice',
        avatar_url: 'https://example.com/alice.jpg',
        native_languages: ['fr'],
        target_languages: ['en'],
      },
    },
    {
      id: 'visit-2',
      created_at: new Date().toISOString(),
      is_blurred: true,
      visitor: {
        id: 'v-2',
        display_name: 'Bob',
        avatar_url: null,
        native_languages: ['ar'],
        target_languages: ['en'],
      },
    },
  ];

  const mockVisitorsAllVisible: VisitorLog[] = [
    {
      id: 'visit-3',
      created_at: new Date().toISOString(),
      is_blurred: false,
      visitor: {
        id: 'v-3',
        display_name: 'Charlie',
        avatar_url: 'https://example.com/charlie.jpg',
        native_languages: ['de'],
        target_languages: ['en'],
      },
    },
  ];

  beforeEach(async () => {
    userService = {
      getMyProfile: vi.fn(),
      getMyVisitors: vi.fn(),
    };
    i18nService = {
      translate: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (params && 'count' in params) {
          return `${key}:${params['count']}`;
        }
        return key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [VisitorLogsComponent],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: I18nService, useValue: i18nService },
        DatePipe,
        TranslatePipe,
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VisitorLogsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load visitors and profile on init', async () => {
    userService.getMyProfile.mockResolvedValue(mockProfile);
    userService.getMyVisitors.mockResolvedValue(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.profile()).toEqual(mockProfile);
    expect(component.visitors()).toEqual(mockVisitors);
    expect(component.isLoading()).toBeFalsy();
  });

  it('should compute visible and blurred counts', async () => {
    userService.getMyProfile.mockResolvedValue(mockProfile);
    userService.getMyVisitors.mockResolvedValue(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.visibleVisitorsCount()).toBe(1);
    expect(component.blurredVisitorsCount()).toBe(1);
  });

  it('should toggle hideBlurred', async () => {
    userService.getMyProfile.mockResolvedValue(mockProfile);
    userService.getMyVisitors.mockResolvedValue(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.filteredVisitors().length).toBe(2);
    component.toggleHideBlurred();
    expect(component.filteredVisitors().length).toBe(1);
  });

  it('should show vip banner when profile is not vip', async () => {
    userService.getMyProfile.mockResolvedValue(mockProfile);
    userService.getMyVisitors.mockResolvedValue([]);

    fixture.detectChanges();
    await fixture.whenStable();

    const banner = fixture.nativeElement.querySelector('.vip-banner');
    expect(banner).toBeTruthy();
  });

  it('should not show vip banner when profile is vip', async () => {
    const vipProfile = { ...mockProfile, is_vip: true };
    userService.getMyProfile.mockResolvedValue(vipProfile);
    userService.getMyVisitors.mockResolvedValue([]);

    fixture.detectChanges();
    await fixture.whenStable();

    const banner = fixture.nativeElement.querySelector('.vip-banner');
    expect(banner).toBeFalsy();
  });

  it('should show loading state', () => {
    userService.getMyProfile.mockReturnValue(new Promise(() => {}));
    userService.getMyVisitors.mockReturnValue(new Promise(() => {}));

    component.isLoading.set(true);
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('.visitor-spinner');
    expect(spinner).toBeTruthy();
  });

  it('should show empty state when no visitors', async () => {
    userService.getMyProfile.mockResolvedValue(mockProfile);
    userService.getMyVisitors.mockResolvedValue([]);

    fixture.detectChanges();
    await fixture.whenStable();

    const empty = fixture.nativeElement.querySelector('.visitor-empty-state p');
    expect(empty?.textContent).toContain('visitors.empty');
  });

  it('should render visitor cards', async () => {
    userService.getMyProfile.mockResolvedValue(mockProfile);
    userService.getMyVisitors.mockResolvedValue(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    const cards = fixture.nativeElement.querySelectorAll('.visitor-card');
    expect(cards.length).toBe(2);
  });

  it('should apply blurred class to cards when is_vip is false', async () => {
    // Free-tier user profile - all visitors should be blurred since isFreeTier() is true
    userService.getMyProfile.mockResolvedValue(mockProfile);
    userService.getMyVisitors.mockResolvedValue(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    // isFreeTier should be true when is_vip is false
    expect(component.isFreeTier()).toBe(true);

    // Both visitors should be blurred via shouldBlur()
    expect(component.shouldBlur(mockVisitors[0])).toBe(true);
    expect(component.shouldBlur(mockVisitors[1])).toBe(true);
  });

  it('should not blur all cards when user is VIP', async () => {
    const vipProfile = { ...mockProfile, is_vip: true };
    userService.getMyProfile.mockResolvedValue(vipProfile);
    userService.getMyVisitors.mockResolvedValue(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isFreeTier()).toBe(false);

    // Only the one with is_blurred: true should be blurred
    expect(component.shouldBlur(mockVisitors[0])).toBe(false);
    expect(component.shouldBlur(mockVisitors[1])).toBe(true);
  });

  it('should blur all visitors on free tier even when backend sends is_blurred: false', async () => {
    userService.getMyProfile.mockResolvedValue(mockProfile);
    userService.getMyVisitors.mockResolvedValue(mockVisitorsAllVisible);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isFreeTier()).toBe(true);

    // All visitors should be blurred on free tier
    for (const log of mockVisitorsAllVisible) {
      expect(component.shouldBlur(log)).toBe(true);
    }
  });

  it('should handle load errors gracefully', async () => {
    userService.getMyProfile.mockRejectedValue(new Error('Network error'));
    userService.getMyVisitors.mockRejectedValue(new Error('Network error'));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isLoading()).toBeFalsy();
    expect(component.visitors()).toEqual([]);
  });
});
