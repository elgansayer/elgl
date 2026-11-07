import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { vi } from 'vitest';
import { ProfileComponent } from './profile.component';
import { UserService, UserProfile } from '../../services/user.service';
import { ProfileVisitsService } from '../../services/profile-visits.service';
import type { ProfileVisit, ProfileVisitorsPage } from '../../interfaces/profile-visit.interface';
import { I18nService } from '../../services/i18n.service';
import { SafetyService } from '../../services/safety.service';
import { AudioIntroRecorderComponent } from '../audio-intro-recorder/audio-intro-recorder.component';

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let mockUserService: {
    getMyProfile: ReturnType<typeof vi.fn>;
    updateMyProfile: ReturnType<typeof vi.fn>;
    updatePrivacySettings: ReturnType<typeof vi.fn>;
  };
  let mockProfileVisits: { getMyVisitors: ReturnType<typeof vi.fn> };

  function makeVisit(id: string, visitor: Partial<ProfileVisit['visitor']> = {}): ProfileVisit {
    return {
      id: `visit-${id}`,
      created_at: '2026-08-24T09:00:00.000Z',
      is_blurred: false,
      visitor: {
        id: `visitor-${id}`,
        display_name: `Visitor ${id}`,
        avatar_url: null,
        native_languages: ['en'],
        target_languages: ['ja'],
        ...visitor,
      },
    };
  }

  function makeMaskedVisit(id: string): ProfileVisit {
    return {
      id: `visit-${id}`,
      created_at: '2026-08-24T09:00:00.000Z',
      is_blurred: true,
      visitor: {
        id: 'hidden-vip-only',
        avatar_url: null,
        native_languages: [],
        target_languages: [],
      },
    };
  }

  function makePage(overrides: Partial<ProfileVisitorsPage> = {}): ProfileVisitorsPage {
    return {
      items: [],
      identity_visible: false,
      limit: 5,
      offset: 0,
      has_more: false,
      next_offset: null,
      ...overrides,
    };
  }

  /** Waits for the initial visitor request, opens the collapsed panel and renders it. */
  async function openVisitorPanel(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(mockProfileVisits.getMyVisitors).toHaveBeenCalled());
    await vi.waitFor(() => expect(fixture.componentInstance.visitorsLoading()).toBe(false));
    fixture.componentInstance.showVisitors.set(true);
    fixture.detectChanges();
  }

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
      updateMyProfile: vi
        .fn()
        .mockImplementation((partial) => Promise.resolve(makeProfile(partial))),
      updatePrivacySettings: vi.fn().mockResolvedValue(makeProfile()),
    };
    mockProfileVisits = { getMyVisitors: vi.fn().mockResolvedValue(makePage()) };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: mockUserService },
        { provide: ProfileVisitsService, useValue: mockProfileVisits },
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

  it('should render native and target languages with the current study streak', async () => {
    mockUserService.getMyProfile.mockResolvedValue(
      makeProfile({
        native_languages: ['en', 'ja'],
        target_languages: ['fr', 'ko'],
        study_streak_days: 14,
      }),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('en, ja');
    expect(text).toContain('fr, ko');
    expect(text).toContain('🔥 14d');
  });

  it('should load and render the saved CEFR proficiency level', async () => {
    mockUserService.getMyProfile.mockResolvedValue(makeProfile({ proficiency_level: 'C1' }));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.proficiencyLevel()).toBe('C1');
    expect(fixture.nativeElement.textContent).toContain('C1');
  });

  it('should preserve an unset proficiency level without inventing a default', async () => {
    mockUserService.getMyProfile.mockResolvedValue(
      makeProfile({ proficiency_level: null }),
    );

    await fixture.componentInstance.loadProfile();

    expect(fixture.componentInstance.proficiencyLevel()).toBe('');

    await fixture.componentInstance.saveProfile();

    expect(mockUserService.updateMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ proficiency_level: null }),
    );
  });

  it('should persist the selected CEFR proficiency level with profile updates', async () => {
    mockUserService.getMyProfile.mockResolvedValue(makeProfile({ proficiency_level: 'A2' }));

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.proficiencyLevel.set('B2');
    await fixture.componentInstance.saveProfile();

    expect(mockUserService.updateMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ proficiency_level: 'B2' }),
    );
  });

  it('should clear a saved proficiency level', async () => {
    mockUserService.getMyProfile.mockResolvedValue(
      makeProfile({ proficiency_level: 'A2' }),
    );

    await fixture.componentInstance.loadProfile();

    fixture.componentInstance.onProficiencyLevelChange('');
    await fixture.componentInstance.saveProfile();

    expect(mockUserService.updateMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ proficiency_level: null }),
    );
  });

  it('should ignore unsupported proficiency values from the select control', () => {
    fixture.componentInstance.proficiencyLevel.set('A1');

    fixture.componentInstance.onProficiencyLevelChange('B3');

    expect(fixture.componentInstance.proficiencyLevel()).toBe('A1');
  });

  it('should expose translated proficiency choices with an accessible label', async () => {
    await fixture.componentInstance.loadProfile();

    fixture.componentInstance.toggleEdit();
    await fixture.whenStable();

    const select: HTMLSelectElement | null = fixture.nativeElement.querySelector(
      'select[name="proficiencyLevel"]',
    );
    const options = Array.from(select?.options ?? []).map((option) => ({
      value: option.value,
      text: option.textContent?.trim(),
    }));

    expect(select?.getAttribute('aria-label')).toBe('profile.proficiencyLabel');
    expect(options).toEqual([
      { value: '', text: 'profile.proficiencyUnset' },
      { value: 'A1', text: 'profile.proficiencyA1' },
      { value: 'A2', text: 'profile.proficiencyA2' },
      { value: 'B1', text: 'profile.proficiencyB1' },
      { value: 'B2', text: 'profile.proficiencyB2' },
      { value: 'C1', text: 'profile.proficiencyC1' },
      { value: 'C2', text: 'profile.proficiencyC2' },
    ]);
  });

  it('round-trips comma-separated learning goals through the array API contract', async () => {
    mockUserService.getMyProfile.mockResolvedValue(
      makeProfile({ learning_goals: ['conversation', 'grammar'] }),
    );

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.learningGoals()).toBe(
      'conversation, grammar',
    );

    fixture.componentInstance.learningGoals.set('conversation, vocabulary,  ');
    await fixture.componentInstance.saveProfile();

    expect(mockUserService.updateMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        learning_goals: ['conversation', 'vocabulary'],
      }),
    );
  });

  it('should bind the saved audio intro to the profile audio player', async () => {
    const audioIntroUrl = 'https://media.example.test/audio/profile-intro.webm';
    mockUserService.getMyProfile.mockResolvedValue(makeProfile({ audio_intro_url: audioIntroUrl }));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const audioIntro = fixture.debugElement.query(By.directive(AudioIntroRecorderComponent));
    expect(audioIntro).not.toBeNull();
    expect((audioIntro.componentInstance as AudioIntroRecorderComponent).existingAudioUrl()).toBe(
      audioIntroUrl,
    );
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

  describe('who viewed me panel', () => {
    function panel(): HTMLElement | null {
      return fixture.nativeElement.querySelector('#profile-visitors-panel');
    }

    function toggle(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('button[aria-controls="profile-visitors-panel"]');
    }

    it('requests one bounded preview page from the canonical visitors service', async () => {
      await openVisitorPanel();

      expect(mockProfileVisits.getMyVisitors).toHaveBeenCalledTimes(1);
      expect(mockProfileVisits.getMyVisitors).toHaveBeenCalledWith(5, 0);
    });

    it('exposes the toggle state and a label that matches what the button does', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const button = toggle();
      expect(button).not.toBeNull();
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.hasAttribute('aria-label')).toBe(false);
      expect(button.textContent?.trim()).toBe('profile.visitorsLink');
      expect(panel()).toBeNull();

      button.click();
      fixture.detectChanges();

      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().textContent?.trim()).toBe('profile.visitorsHide');
      expect(panel()).not.toBeNull();
      expect(panel()?.getAttribute('aria-labelledby')).toBe('profile-visitors-heading');
      expect(panel()?.querySelector('#profile-visitors-heading')?.textContent).toContain(
        'profile.visitorsTitle',
      );
    });

    it('renders blurred non-identifying cards and an upgrade path for free users', async () => {
      mockProfileVisits.getMyVisitors.mockResolvedValue(
        makePage({
          identity_visible: false,
          items: [makeMaskedVisit('1'), makeMaskedVisit('2')],
        }),
      );

      await openVisitorPanel();

      const cards = fixture.nativeElement.querySelectorAll('.profile-visitor-chip--masked');
      expect(cards).toHaveLength(2);
      for (const card of Array.from<HTMLElement>(cards)) {
        const blurred = card.querySelector('[aria-hidden="true"]');
        expect(blurred?.classList.contains('blur-sm')).toBe(true);
        expect(blurred?.textContent?.trim()).toBe('');
        expect(card.textContent).toContain('visitors.vipOnly');
        expect(card.querySelector('time')?.getAttribute('datetime')).toBe(
          '2026-08-24T09:00:00.000Z',
        );
        expect(card.querySelector('.sr-only')?.textContent).toContain('profile.anonymousVisitor');
      }

      const upgrade = panel()?.querySelector('a[href="/subscription"]');
      expect(upgrade?.textContent).toContain('vip.seePlans');
      expect(panel()?.textContent).toContain('visitors.vipBannerDesc');
      expect(panel()?.querySelector('a[href^="/profile/"]')).toBeNull();
    });

    it('never renders identity from rows the server masked, even if the payload still carries it', async () => {
      // The service strips identity before the component sees it. This asserts the component's own
      // second line of defence: its masked card model has no identity fields to bind.
      mockProfileVisits.getMyVisitors.mockResolvedValue(
        makePage({
          identity_visible: false,
          items: [
            makeVisit('1', {
              id: 'private-user-id',
              display_name: 'Private Name',
              avatar_url: 'https://example.com/private.jpg',
            }),
            { ...makeVisit('2', { display_name: 'Someone viewed your profile' }), is_blurred: true },
          ],
        }),
      );

      await openVisitorPanel();

      const html = (panel()?.innerHTML ?? '') + (panel()?.textContent ?? '');
      expect(html).not.toContain('Private Name');
      expect(html).not.toContain('private.jpg');
      expect(html).not.toContain('private-user-id');
      expect(html).not.toContain('Someone viewed your profile');
      expect(fixture.nativeElement.querySelectorAll('.profile-visitor-chip--masked')).toHaveLength(
        2,
      );
      expect(panel()?.querySelector('img')).toBeNull();
    });

    it('treats a masked row inside an identity_visible page as masked', async () => {
      mockProfileVisits.getMyVisitors.mockResolvedValue(
        makePage({
          identity_visible: true,
          items: [makeVisit('1', { display_name: 'Aiko' }), makeMaskedVisit('2')],
        }),
      );

      await openVisitorPanel();

      expect(fixture.nativeElement.querySelectorAll('.profile-visitor-chip--masked')).toHaveLength(
        1,
      );
      expect(panel()?.textContent).toContain('Aiko');
    });

    it('shows names, avatars and times to VIP users without an upgrade prompt', async () => {
      mockProfileVisits.getMyVisitors.mockResolvedValue(
        makePage({
          identity_visible: true,
          items: [
            makeVisit('1', { display_name: 'Aiko', avatar_url: 'https://example.com/aiko.jpg' }),
            makeVisit('2', { display_name: 'Ben' }),
          ],
        }),
      );

      await openVisitorPanel();

      const text = panel()?.textContent ?? '';
      expect(text).toContain('Aiko');
      expect(text).toContain('Ben');
      expect(panel()?.querySelectorAll('li')).toHaveLength(2);
      const avatar = panel()?.querySelector('img');
      expect(avatar?.getAttribute('src')).toBe('https://example.com/aiko.jpg');
      expect(avatar?.getAttribute('alt')).toBe('');
      expect(panel()?.querySelector('.profile-visitor-chip--masked')).toBeNull();
      expect(panel()?.querySelector('a[href="/subscription"]')).toBeNull();
      expect(text).not.toContain('visitors.vipOnly');
    });

    it('labels visible visitors without a name or avatar using translated fallbacks', async () => {
      mockProfileVisits.getMyVisitors.mockResolvedValue(
        makePage({
          identity_visible: true,
          items: [makeVisit('1', { display_name: undefined, avatar_url: null })],
        }),
      );

      await openVisitorPanel();

      expect(panel()?.textContent).toContain('common.unknownUser');
      expect(panel()?.textContent).toContain('?');
    });

    it('announces loading with a polite status region while visitors are fetched', async () => {
      mockProfileVisits.getMyVisitors.mockReturnValue(new Promise(() => undefined));

      fixture.detectChanges();
      await fixture.whenStable();
      await vi.waitFor(() => expect(mockProfileVisits.getMyVisitors).toHaveBeenCalled());
      fixture.componentInstance.showVisitors.set(true);
      fixture.detectChanges();

      expect(panel()?.getAttribute('aria-busy')).toBe('true');
      const status = panel()?.querySelector('[role="status"]');
      expect(status?.textContent).toContain('visitors.loading');
      expect(panel()?.querySelector('ul')).toBeNull();
    });

    it('shows the empty state when nobody has visited', async () => {
      await openVisitorPanel();

      expect(panel()?.textContent).toContain('visitors.empty');
      expect(panel()?.querySelector('ul')).toBeNull();
    });

    it('shows a localised alert with retry instead of the raw provider error, then recovers', async () => {
      mockProfileVisits.getMyVisitors.mockRejectedValueOnce(
        new Error('visits.slice is not a function'),
      );

      await openVisitorPanel();

      const alert = panel()?.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('common.error_generic');
      expect(panel()?.textContent).not.toContain('visits.slice');
      expect(panel()?.querySelector('ul')).toBeNull();

      mockProfileVisits.getMyVisitors.mockResolvedValueOnce(
        makePage({ identity_visible: true, items: [makeVisit('1', { display_name: 'Aiko' })] }),
      );
      const retry = alert?.querySelector('button');
      expect(retry?.textContent).toContain('common.retry');
      retry?.click();
      await vi.waitFor(() => expect(fixture.componentInstance.visitorsLoading()).toBe(false));
      fixture.detectChanges();

      expect(fixture.componentInstance.visitorsError()).toBe(false);
      expect(panel()?.querySelector('[role="alert"]')).toBeNull();
      expect(panel()?.textContent).toContain('Aiko');
      expect(mockProfileVisits.getMyVisitors).toHaveBeenCalledTimes(2);
    });

    it('drops previously loaded identities when a later reload fails', async () => {
      mockProfileVisits.getMyVisitors.mockResolvedValueOnce(
        makePage({ identity_visible: true, items: [makeVisit('1', { display_name: 'Aiko' })] }),
      );
      await openVisitorPanel();
      expect(panel()?.textContent).toContain('Aiko');

      mockProfileVisits.getMyVisitors.mockRejectedValueOnce(new Error('offline'));
      await fixture.componentInstance.loadVisitors();
      fixture.detectChanges();

      expect(fixture.componentInstance.visitors()).toEqual([]);
      expect(fixture.componentInstance.visitorsIdentityVisible()).toBe(false);
      expect(panel()?.textContent).not.toContain('Aiko');
      expect(panel()?.querySelector('[role="alert"]')).not.toBeNull();
    });

    it('never reads the legacy UserService visitor method', async () => {
      await openVisitorPanel();

      expect(Object.keys(mockUserService)).not.toContain('getMyVisitors');
      expect(mockProfileVisits.getMyVisitors).toHaveBeenCalled();
    });
  });
});
