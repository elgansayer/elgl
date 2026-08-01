import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ProfileComponent } from './profile.component';
import { UserService, UserProfile } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let mockUserService: {
    getMyProfile: ReturnType<typeof vi.fn>;
    getMyVisitors: ReturnType<typeof vi.fn>;
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
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: mockUserService },
        { provide: SafetyService, useValue: { blockedUserIdsSignal: signal(new Set()) } },
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
});
