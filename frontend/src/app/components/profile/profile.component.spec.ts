import { Component, input, output, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { vi } from 'vitest';
import { ProfileComponent } from './profile.component';
import { ProfileLanguageBadgesComponent } from './profile-language-badges/profile-language-badges.component';
import { UserService, UserProfile } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { SafetyService } from '../../services/safety.service';
import { AudioIntroRecorderComponent } from '../audio-intro-recorder/audio-intro-recorder.component';
import { CelebrationOverlayComponent } from '../celebration-overlay/celebration-overlay.component';
import { AchievementsComponent } from '../../achievements/achievements.component';
import { HobbyTagsComponent } from '../hobby-tags/hobby-tags.component';

@Component({ selector: 'app-achievements', template: '' })
class ProfileAchievementsStubComponent {
  readonly userId = input.required<string>();
}

@Component({ selector: 'app-celebration-overlay', template: '' })
class ProfileCelebrationStubComponent {
  readonly milestone = input.required<number>();
  readonly visible = input(false);
  readonly dismissed = output<void>();
}

@Component({ selector: 'app-hobby-tags', template: '' })
class ProfileHobbyTagsStubComponent {
  readonly targetLanguage = input('en');
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

function createUserServiceMock() {
  return {
    getMyProfile: vi.fn().mockResolvedValue(makeProfile()),
    getMyVisitors: vi.fn().mockResolvedValue([]),
    updateMyProfile: vi.fn().mockImplementation((partial) => Promise.resolve(makeProfile(partial))),
    updatePrivacySettings: vi.fn().mockResolvedValue(makeProfile()),
  };
}

function normalisedText(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function languageBadgeText(element: Element): string {
  return Array.from(element.querySelectorAll(':scope > span'))
    .map(normalisedText)
    .filter(Boolean)
    .join(' ');
}

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let mockUserService: ReturnType<typeof createUserServiceMock>;

  const copy: Record<string, string> = {
    'profile.studyStreakHeading': 'Study streak',
    'profile.studyStreakDays.one': '{{count}} day',
    'profile.studyStreakDays.other': '{{count}} days',
    'profile.correctionValue': '{{ratio}}x',
    'profile.maxLanguagesError': 'You can choose up to 3 learning languages.',
    'profile.visitorsError': 'Unable to load visitors.',
  };

  function translate(key: string, params?: Record<string, unknown>): string {
    let text = copy[key] ?? key;
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace(`{{${name}}}`, String(value));
    }
    return text;
  }

  async function renderProfile(): Promise<void> {
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.isLoading()).toBe(false));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockUserService = createUserServiceMock();
    TestBed.overrideComponent(ProfileComponent, {
      remove: { imports: [AchievementsComponent, CelebrationOverlayComponent, HobbyTagsComponent] },
      add: {
        imports: [
          ProfileAchievementsStubComponent,
          ProfileCelebrationStubComponent,
          ProfileHobbyTagsStubComponent,
        ],
      },
    });

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: mockUserService },
        { provide: SafetyService, useValue: { blockedUserIdsSignal: signal(new Set()) } },
        {
          provide: I18nService,
          useValue: { currentLang: signal('en-GB'), translate: vi.fn(translate) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
  });

  it('should link to the My Stats dashboard', async () => {
    await renderProfile();

    const statsLinks: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('a[href="/stats"]'),
    );

    expect(statsLinks).toHaveLength(1);
    expect(statsLinks[0].textContent).toContain('profile.statsLink');
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

  describe('learning summary', () => {
    function badgeGroups(): string[][] {
      return fixture.debugElement
        .queryAll(By.directive(ProfileLanguageBadgesComponent))
        .map((group) =>
          Array.from<Element>(group.nativeElement.querySelectorAll('li')).map(languageBadgeText),
        );
    }

    function streakText(): string {
      const value: Element | null = fixture.nativeElement.querySelector(
        '[data-testid="study-streak-value"]',
      );
      return value ? normalisedText(value) : '';
    }

    it('should render native and target languages as separate badge groups', async () => {
      mockUserService.getMyProfile.mockResolvedValue(
        makeProfile({
          native_languages: ['en', 'ja'],
          target_languages: ['fr', 'ko'],
          study_streak_days: 14,
        }),
      );

      await renderProfile();

      expect(badgeGroups()).toEqual([
        ['🇬🇧 English', '🇯🇵 Japanese'],
        ['🇫🇷 French', '🇰🇷 Korean'],
      ]);
    });

    it('should show the current study streak as a translated, plural-aware label', async () => {
      mockUserService.getMyProfile.mockResolvedValue(makeProfile({ study_streak_days: 14 }));

      await renderProfile();

      expect(streakText()).toBe('14 days');
      expect(fixture.nativeElement.textContent).not.toContain('14d');
    });

    it('should use the singular unit for a one day streak', async () => {
      mockUserService.getMyProfile.mockResolvedValue(makeProfile({ study_streak_days: 1 }));

      await renderProfile();

      expect(streakText()).toBe('1 day');
    });

    it('should show a zero streak honestly instead of inventing progress', async () => {
      mockUserService.getMyProfile.mockResolvedValue(makeProfile({ study_streak_days: 0 }));

      await renderProfile();

      expect(streakText()).toBe('0 days');
    });

    it('should tolerate a profile without a target language list', async () => {
      const apiProfile: unknown = { ...makeProfile(), target_languages: null };
      mockUserService.getMyProfile.mockResolvedValue(apiProfile);

      await renderProfile();

      expect(badgeGroups()).toEqual([['🇬🇧 English'], []]);
      expect(fixture.nativeElement.textContent).toContain('profile.languagesNotSet');
    });

    it('should expose the summary as one labelled region and no longer print comma joined codes', async () => {
      mockUserService.getMyProfile.mockResolvedValue(
        makeProfile({ native_languages: ['en', 'ja'], target_languages: ['fr', 'ko'] }),
      );

      await renderProfile();

      const region: Element | null = fixture.nativeElement.querySelector(
        'section[aria-label="profile.learningSummaryLabel"]',
      );
      expect(region).not.toBeNull();
      expect(region?.querySelectorAll('app-profile-language-badges')).toHaveLength(2);
      expect(fixture.nativeElement.textContent).not.toContain('en, ja');
    });

    it('should keep the corrections and corrector score stats beside the summary', async () => {
      mockUserService.getMyProfile.mockResolvedValue(
        makeProfile({ correction_ratio: 1.8, corrector_score: 4.6 }),
      );

      await renderProfile();

      const text = normalisedText(fixture.nativeElement);
      expect(text).toContain('profile.correctionsLabel');
      expect(text).toContain('1.8x');
      expect(text).toContain('4.6 / 5');
    });

    it('should distinguish an unavailable score from a profile with no ratings', async () => {
      mockUserService.getMyProfile.mockResolvedValue(makeProfile({ corrector_score: null }));
      await renderProfile();
      expect(normalisedText(fixture.nativeElement)).toContain('profile.noRatings');

      mockUserService.getMyProfile.mockResolvedValue(
        makeProfile({
          corrector_score: null,
          corrector_score_unavailable: true,
        }),
      );
      await fixture.componentInstance.loadProfile();
      fixture.detectChanges();
      expect(normalisedText(fixture.nativeElement)).toContain('profile.correctorScoreUnavailable');
    });
  });

  describe('when the profile cannot be loaded', () => {
    function alert(): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-testid="profile-load-error"]');
    }

    it('should show an accessible error with a retry action when the request resolves empty', async () => {
      mockUserService.getMyProfile.mockResolvedValue(null);

      await renderProfile();

      expect(fixture.componentInstance.profile()).toBeNull();
      expect(mockUserService.getMyVisitors).not.toHaveBeenCalled();
      expect(alert()?.textContent).toContain('profile.loadError');
      expect(alert()?.querySelector('button')?.textContent?.trim()).toBe('common.retry');
    });

    it('should not manufacture a profile or render the learning summary', async () => {
      mockUserService.getMyProfile.mockResolvedValue(null);

      await renderProfile();

      expect(fixture.nativeElement.querySelector('app-profile-language-badges')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-audio-intro-recorder')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-profile-study-streak')).toBeNull();
    });

    it('should show translated generic copy when the request rejects', async () => {
      mockUserService.getMyProfile.mockRejectedValue(new Error('Network error'));

      await renderProfile();

      expect(alert()?.textContent).toContain('profile.loadError');
      expect(alert()?.textContent).not.toContain('Network error');
    });

    it('should not show the error while the profile is still loading', () => {
      mockUserService.getMyProfile.mockReturnValue(new Promise(() => undefined));

      fixture.detectChanges();

      expect(fixture.componentInstance.isLoading()).toBe(true);
      expect(alert()).toBeNull();
    });

    it('should recover when retry succeeds and clear the error', async () => {
      mockUserService.getMyProfile
        .mockResolvedValueOnce(null)
        .mockResolvedValue(makeProfile({ display_name: 'Mei Lin' }));
      await renderProfile();
      expect(alert()).not.toBeNull();

      const retry: HTMLButtonElement | null | undefined = alert()?.querySelector('button');
      retry?.click();
      await vi.waitFor(() =>
        expect(fixture.componentInstance.profile()?.display_name).toBe('Mei Lin'),
      );
      fixture.detectChanges();

      expect(mockUserService.getMyProfile).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.errorMessage()).toBe('');
      expect(alert()).toBeNull();
      expect(fixture.nativeElement.querySelector('app-profile-language-badges')).not.toBeNull();
    });

    it('should keep the error visible when retry fails again', async () => {
      mockUserService.getMyProfile.mockResolvedValue(null);
      await renderProfile();

      await fixture.componentInstance.retryLoad();
      fixture.detectChanges();

      expect(mockUserService.getMyProfile).toHaveBeenCalledTimes(2);
      expect(alert()?.textContent).toContain('profile.loadError');
    });

    it('should load visitors after a successful retry only', async () => {
      mockUserService.getMyProfile.mockResolvedValue(null);
      await renderProfile();
      const visitorCallsAfterInit = mockUserService.getMyVisitors.mock.calls.length;

      await fixture.componentInstance.retryLoad();
      expect(mockUserService.getMyVisitors).toHaveBeenCalledTimes(visitorCallsAfterInit);

      mockUserService.getMyProfile.mockResolvedValue(makeProfile());
      await fixture.componentInstance.retryLoad();
      expect(mockUserService.getMyVisitors).toHaveBeenCalledTimes(visitorCallsAfterInit + 1);
    });

    it('should ignore a retry while a load is already in flight', async () => {
      mockUserService.getMyProfile.mockResolvedValue(null);
      await renderProfile();
      let resolveProfile: (profile: UserProfile) => void = () => undefined;
      mockUserService.getMyProfile.mockReturnValueOnce(
        new Promise<UserProfile>((resolve) => {
          resolveProfile = resolve;
        }),
      );

      const first = fixture.componentInstance.retryLoad();
      await fixture.componentInstance.retryLoad();
      resolveProfile(makeProfile());
      await first;

      expect(mockUserService.getMyProfile).toHaveBeenCalledTimes(2);
    });
  });

  it('should not expose visitor transport details when that partial request fails', async () => {
    mockUserService.getMyVisitors.mockRejectedValue(new Error('provider response with user data'));

    await fixture.componentInstance.loadVisitors();

    expect(fixture.componentInstance.visitorsError()).toBe('Unable to load visitors.');
    expect(fixture.componentInstance.visitorsError()).not.toContain('provider response');
  });

  it('should load and render the saved CEFR proficiency level', async () => {
    mockUserService.getMyProfile.mockResolvedValue(makeProfile({ proficiency_level: 'C1' }));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.proficiencyLevel()).toBe('C1');
    expect(fixture.nativeElement.textContent).toContain('C1');
  });

  it('should use translated feedback when the learning-language limit is reached', () => {
    fixture.componentInstance.targetLanguages = ['fr', 'de', 'ja'];

    fixture.componentInstance.addTargetLanguage('es');

    expect(fixture.componentInstance.targetLanguages).toEqual(['fr', 'de', 'ja']);
    expect(fixture.componentInstance.errorMessage()).toBe(
      'You can choose up to 3 learning languages.',
    );
  });

  it('should preserve an unset proficiency level without inventing a default', async () => {
    mockUserService.getMyProfile.mockResolvedValue(makeProfile({ proficiency_level: null }));

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
    mockUserService.getMyProfile.mockResolvedValue(makeProfile({ proficiency_level: 'A2' }));

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

    expect(fixture.componentInstance.learningGoals()).toBe('conversation, grammar');

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

  it('keeps all profile visibility choices large enough for touch input', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.toggleEdit();
    fixture.detectChanges();

    const choices: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('[role="radiogroup"] button');
    expect(choices).toHaveLength(3);
    for (const choice of choices) {
      expect(choice.classList.contains('min-h-11')).toBe(true);
    }
  });

  it('should not expose raw transport details when loadProfile fails', async () => {
    mockUserService.getMyProfile.mockRejectedValue(new Error('Network error'));
    await fixture.componentInstance.loadProfile();
    expect(fixture.componentInstance.errorMessage()).toBe('profile.loadError');
  });
});

// The suite above stubs I18nService, which hides copy that has no dictionary entry: translate()
// falls back to printing the key. These tests use the real service so such a gap fails here.
describe('ProfileComponent with the real dictionary', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let mockUserService: ReturnType<typeof createUserServiceMock>;

  const UNTRANSLATED_KEY = /\b(?:profile|privacy)\.[A-Za-z]\w*(?:\.[A-Za-z]\w*)*/g;
  const LABEL_ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt'];

  function leakedKeys(root: HTMLElement): string[] {
    const sources = [root.textContent ?? ''];
    for (const element of Array.from(root.querySelectorAll('*'))) {
      for (const attribute of LABEL_ATTRIBUTES) {
        sources.push(element.getAttribute(attribute) ?? '');
      }
    }
    return [...new Set(sources.flatMap((source) => source.match(UNTRANSLATED_KEY) ?? []))].sort();
  }

  async function renderProfile(): Promise<void> {
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.isLoading()).toBe(false));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    mockUserService = createUserServiceMock();
    mockUserService.getMyProfile.mockResolvedValue(
      makeProfile({
        display_name: 'Mei Lin',
        avatar_url: 'https://media.example.test/avatar/mei-lin.jpg',
        is_vip: true,
        native_languages: ['zh', 'en-GB'],
        target_languages: ['en', 'es'],
        study_streak_days: 47,
        correction_ratio: 1.8,
        corrector_score: 4.6,
        nationality: 'Taiwan',
        region: 'Taipei',
        age: 29,
        gender: 'female',
        proficiency_level: 'B2',
        bio_text: 'Learning English one conversation at a time.',
        status_text: 'Open to chat',
      }),
    );

    TestBed.overrideComponent(ProfileComponent, {
      remove: { imports: [AchievementsComponent, CelebrationOverlayComponent, HobbyTagsComponent] },
      add: {
        imports: [
          ProfileAchievementsStubComponent,
          ProfileCelebrationStubComponent,
          ProfileHobbyTagsStubComponent,
        ],
      },
    });

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getAccessToken: () => null } },
        { provide: UserService, useValue: mockUserService },
        { provide: SafetyService, useValue: { blockedUserIdsSignal: signal(new Set()) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
  });

  it('should render the learning summary with real English copy', async () => {
    await renderProfile();

    const text = normalisedText(fixture.nativeElement);
    expect(text).toContain('Native languages');
    expect(text).toContain('Learning languages');
    expect(text).toContain('Study streak');
    expect(text).toContain('47 days');
    expect(text).toContain('Chinese');
    expect(text).toContain('British English');
    expect(text).toContain('Spanish');
  });

  it('should expose the profile photo as a keyboard-operable translated action', async () => {
    await renderProfile();

    const avatarButton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'button[aria-label="Change photo"]',
    );
    expect(avatarButton).not.toBeNull();
    expect(avatarButton?.type).toBe('button');
    expect(avatarButton?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(avatarButton?.hasAttribute('hlmbtn')).toBe(true);
  });

  it('should not leak untranslated profile or privacy keys in view mode', async () => {
    await renderProfile();

    expect(leakedKeys(fixture.nativeElement)).toEqual([]);
  });

  it('should not leak untranslated profile or privacy keys in edit mode', async () => {
    await renderProfile();

    fixture.componentInstance.toggleEdit();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(leakedKeys(fixture.nativeElement)).toEqual([]);
    expect(
      fixture.nativeElement.querySelector('#profile-learning-goals')?.getAttribute('placeholder'),
    ).toBe('');
    expect(normalisedText(fixture.nativeElement)).toContain(
      'Share your motivations so compatible language partners can understand your goals.',
    );
    const labelledInputs = Array.from<HTMLInputElement>(
      fixture.nativeElement.querySelectorAll('app-input input'),
    );
    expect(labelledInputs).not.toHaveLength(0);
    for (const input of labelledInputs) {
      expect(input.getAttribute('placeholder')).toBe('');
      expect(input.labels?.item(0)?.textContent?.trim()).not.toBe('');
    }
  });

  it('should not leak untranslated keys when the profile fails to load', async () => {
    mockUserService.getMyProfile.mockResolvedValue(null);

    await renderProfile();

    expect(normalisedText(fixture.nativeElement)).toContain('Failed to load profile');
    expect(normalisedText(fixture.nativeElement)).toContain('Retry');
    expect(leakedKeys(fixture.nativeElement)).toEqual([]);
  });

  it('should describe the visitors toggle by its current action', async () => {
    await renderProfile();
    const toggle = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('button[aria-expanded]');

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe(normalisedText(toggle()));

    toggle().click();
    fixture.detectChanges();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Hide visitors');
    expect(normalisedText(toggle())).toBe('Hide visitors');
  });

  it('should format the joined date through a single translated sentence', async () => {
    await renderProfile();

    expect(normalisedText(fixture.nativeElement)).toMatch(/Joined \w{3} \d{1,2}, 20\d{2}/);
  });
});
