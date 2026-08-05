import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VisitorLogsComponent } from './visitor-logs.component';
import { UserService, VisitorLog, UserProfile } from '../../services/user.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { DatePipe } from '@angular/common';
import { provideRouter } from '@angular/router';

describe('VisitorLogsComponent', () => {
  let component: VisitorLogsComponent;
  let fixture: ComponentFixture<VisitorLogsComponent>;
  let userService: jasmine.SpyObj<UserService>;
  let i18nService: jasmine.SpyObj<I18nService>;

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

  beforeEach(async () => {
    userService = jasmine.createSpyObj<UserService>('UserService', [
      'getMyProfile',
      'getMyVisitors',
    ]);
    i18nService = jasmine.createSpyObj<I18nService>('I18nService', ['translate']);

    i18nService.translate.and.callFake((key: string, params?: Record<string, unknown>) => {
      if (params && 'count' in params) {
        return `${key}:${params['count']}`;
      }
      return key;
    });

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
    userService.getMyProfile.and.resolveTo(mockProfile);
    userService.getMyVisitors.and.resolveTo(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.profile()).toEqual(mockProfile);
    expect(component.visitors()).toEqual(mockVisitors);
    expect(component.isLoading()).toBeFalse();
  });

  it('should compute visible and blurred counts', async () => {
    userService.getMyProfile.and.resolveTo(mockProfile);
    userService.getMyVisitors.and.resolveTo(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.visibleVisitorsCount()).toBe(1);
    expect(component.blurredVisitorsCount()).toBe(1);
  });

  it('should toggle hideBlurred', async () => {
    userService.getMyProfile.and.resolveTo(mockProfile);
    userService.getMyVisitors.and.resolveTo(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.filteredVisitors().length).toBe(2);
    component.toggleHideBlurred();
    expect(component.filteredVisitors().length).toBe(1);
  });

  it('should show vip banner when profile is not vip', async () => {
    userService.getMyProfile.and.resolveTo(mockProfile);
    userService.getMyVisitors.and.resolveTo([]);

    fixture.detectChanges();
    await fixture.whenStable();

    const banner = fixture.nativeElement.querySelector('.vip-banner');
    expect(banner).toBeTruthy();
  });

  it('should not show vip banner when profile is vip', async () => {
    const vipProfile = { ...mockProfile, is_vip: true };
    userService.getMyProfile.and.resolveTo(vipProfile);
    userService.getMyVisitors.and.resolveTo([]);

    fixture.detectChanges();
    await fixture.whenStable();

    const banner = fixture.nativeElement.querySelector('.vip-banner');
    expect(banner).toBeFalsy();
  });

  it('should show loading state', () => {
    userService.getMyProfile.and.returnValue(new Promise(() => {}));
    userService.getMyVisitors.and.returnValue(new Promise(() => {}));

    component.isLoading.set(true);
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('.visitor-spinner');
    expect(spinner).toBeTruthy();
  });

  it('should show empty state when no visitors', async () => {
    userService.getMyProfile.and.resolveTo(mockProfile);
    userService.getMyVisitors.and.resolveTo([]);

    fixture.detectChanges();
    await fixture.whenStable();

    const empty = fixture.nativeElement.querySelector('.visitor-empty-state p');
    expect(empty?.textContent).toContain('visitors.empty');
  });

  it('should render visitor cards', async () => {
    userService.getMyProfile.and.resolveTo(mockProfile);
    userService.getMyVisitors.and.resolveTo(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    const cards = fixture.nativeElement.querySelectorAll('.visitor-card');
    expect(cards.length).toBe(2);
  });

  it('should apply blurred class to blurred cards', async () => {
    userService.getMyProfile.and.resolveTo(mockProfile);
    userService.getMyVisitors.and.resolveTo(mockVisitors);

    fixture.detectChanges();
    await fixture.whenStable();

    const blurredCards = fixture.nativeElement.querySelectorAll('.visitor-card--blurred');
    expect(blurredCards.length).toBe(1);
  });

  it('should handle load errors gracefully', async () => {
    userService.getMyProfile.and.rejectWith(new Error('Network error'));
    userService.getMyVisitors.and.rejectWith(new Error('Network error'));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isLoading()).toBeFalse();
    expect(component.visitors()).toEqual([]);
  });
});
