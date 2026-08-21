import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { provideRouter } from '@angular/router';
import { VisitorLogsComponent } from './visitor-logs.component';
import { UserService, VisitorLog, UserProfile } from '../../services/user.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('VisitorLogsComponent', () => {
  let component: VisitorLogsComponent;
  let fixture: ComponentFixture<VisitorLogsComponent>;
  let userService: {
    getMyProfile: ReturnType<typeof vi.fn>;
    getMyVisitors: ReturnType<typeof vi.fn>;
  };
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
        display_name: 'Bob Secret',
        avatar_url: 'https://example.com/bob-secret.jpg',
        native_languages: ['ar'],
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
  });

  function createComponent(
    profile: UserProfile | null = mockProfile,
    visitors: VisitorLog[] = mockVisitors,
  ): void {
    userService.getMyProfile.mockResolvedValue(profile);
    userService.getMyVisitors.mockResolvedValue(visitors);
    fixture = TestBed.createComponent(VisitorLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads visitor data and exposes visible and blurred counts', async () => {
    createComponent();
    await settle();

    expect(component.profile()).toEqual(mockProfile);
    expect(component.visitors()).toEqual(mockVisitors);
    expect(component.visibleVisitorsCount()).toBe(1);
    expect(component.blurredVisitorsCount()).toBe(1);
    expect(component.isLoading()).toBe(false);
    expect(component.loadError()).toBe(false);
  });

  it('shows the VIP upgrade prompt and standard price to free users', async () => {
    createComponent(mockProfile, []);
    await settle();

    const banner = fixture.nativeElement.querySelector('.vip-banner') as HTMLElement | null;
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('common.vipStdLabel');
    expect(banner?.querySelector('a')?.getAttribute('href')).toBe('/vip');
  });

  it('uses server masking as an entitlement signal even if the profile appears VIP', async () => {
    createComponent({ ...mockProfile, is_vip: true }, [mockVisitors[1]!]);
    await settle();

    expect(component.showUpgrade()).toBe(true);
    expect(fixture.nativeElement.querySelector('.vip-banner')).toBeTruthy();
  });

  it('hides the upgrade prompt for VIP users when every visitor is visible', async () => {
    createComponent({ ...mockProfile, is_vip: true }, [mockVisitors[0]!]);
    await settle();

    expect(component.showUpgrade()).toBe(false);
    expect(fixture.nativeElement.querySelector('.vip-banner')).toBeFalsy();
  });

  it('does not render masked visitor identity or avatar URLs into the DOM', async () => {
    createComponent(mockProfile, [mockVisitors[1]!]);
    await settle();

    const html = fixture.nativeElement.innerHTML as string;
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Bob Secret');
    expect(html).not.toContain('bob-secret.jpg');
    expect(fixture.nativeElement.querySelector('.visitor-card--blurred')).toBeTruthy();
  });

  it('renders real identity and avatar for unmasked visitors', async () => {
    createComponent({ ...mockProfile, is_vip: true }, [mockVisitors[0]!]);
    await settle();

    expect(fixture.nativeElement.textContent).toContain('Alice');
    const image = fixture.nativeElement.querySelector('.visitor-avatar') as HTMLImageElement | null;
    expect(image?.getAttribute('src')).toBe('https://example.com/alice.jpg');
  });

  it('keeps visitor logs usable when profile loading fails', async () => {
    userService.getMyProfile.mockRejectedValue(new Error('profile unavailable'));
    userService.getMyVisitors.mockResolvedValue([mockVisitors[0]!]);
    fixture = TestBed.createComponent(VisitorLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();

    expect(component.loadError()).toBe(false);
    expect(component.visitors()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Alice');
  });

  it('shows an accessible retry state when visitor loading fails and recovers on retry', async () => {
    userService.getMyProfile.mockResolvedValue(mockProfile);
    userService.getMyVisitors
      .mockRejectedValueOnce(new Error('visitor API unavailable'))
      .mockResolvedValueOnce([mockVisitors[0]!]);
    fixture = TestBed.createComponent(VisitorLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();

    expect(component.loadError()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    await component.reload();
    fixture.detectChanges();

    expect(component.loadError()).toBe(false);
    expect(component.visitors()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Alice');
  });

  it('can hide masked rows without affecting visible rows', async () => {
    createComponent();
    await settle();

    expect(component.filteredVisitors()).toHaveLength(2);
    component.toggleHideBlurred();
    fixture.detectChanges();

    expect(component.filteredVisitors()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Alice');
    expect(fixture.nativeElement.querySelector('.visitor-card--blurred')).toBeFalsy();
  });

  it('labels the page and reports loading state semantically', () => {
    userService.getMyProfile.mockReturnValue(new Promise(() => undefined));
    userService.getMyVisitors.mockReturnValue(new Promise(() => undefined));
    fixture = TestBed.createComponent(VisitorLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const main = fixture.nativeElement.querySelector('main') as HTMLElement;
    expect(main.getAttribute('aria-labelledby')).toBe('visitor-logs-title');
    expect(main.getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });
});
