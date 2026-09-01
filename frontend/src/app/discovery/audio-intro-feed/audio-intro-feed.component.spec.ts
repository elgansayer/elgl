import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioIntroFeedComponent } from './audio-intro-feed.component';
import { socialRoutes } from '../../routes/social.routes';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';
import { UserProfile } from '../../services/user.service';

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    display_name: 'Kenji',
    avatar_url: null,
    native_languages: ['ja'],
    target_languages: ['en'],
    audio_intro_url: 'https://example.com/intro.mp3',
    is_vip: false,
    vip_tier: 'none',
    coins_balance: 0,
    study_streak_days: 0,
    correction_ratio: 0,
    is_serious_learner: false,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    privacy_hide_gender: false,
    ...overrides,
  } as UserProfile;
}

class MockAudio {
  static instances: MockAudio[] = [];

  readonly src: string;
  readonly play = vi.fn().mockResolvedValue(undefined);
  readonly pause = vi.fn();
  private readonly listeners = new Map<string, Array<() => void>>();

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }

  addEventListener(event: string, listener: () => void): void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

describe('AudioIntroFeedComponent', () => {
  let component: AudioIntroFeedComponent;
  let fixture: ComponentFixture<AudioIntroFeedComponent>;
  let getAudioIntros: ReturnType<typeof vi.fn>;
  let currentLang: ReturnType<typeof signal<string>>;

  beforeEach(async () => {
    MockAudio.instances = [];
    vi.stubGlobal('Audio', MockAudio);

    getAudioIntros = vi.fn().mockResolvedValue([makeUser()]);
    currentLang = signal('en-GB');
    const i18nServiceMock = {
      translate: (key: string, params?: Record<string, unknown>) =>
        key === 'discovery.audioIntroFeed.languagePair'
          ? `${params?.['native']} → ${params?.['target']}`
          : key,
      currentLang,
      translations: signal({}) as unknown as I18nService['translations'],
    };

    await TestBed.configureTestingModule({
      imports: [AudioIntroFeedComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: { getAudioIntros } },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioIntroFeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('loads and renders partners with audio introductions', () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(getAudioIntros).toHaveBeenCalledOnce();
    expect(component.users()).toHaveLength(1);
    expect(el.textContent).toContain('Kenji');
    expect(el.querySelector('a[href="/profile/u1"]')).not.toBeNull();
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('K');
  });

  it('navigates to the exposed audio-intro route and renders the feed', async () => {
    getAudioIntros.mockClear();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(socialRoutes),
        { provide: DiscoveryService, useValue: { getAudioIntros } },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
            translations: signal({}),
          },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/discovery/audio-intros', AudioIntroFeedComponent);
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    expect(getAudioIntros).toHaveBeenCalledOnce();
    expect(harness.routeNativeElement?.textContent).toContain('Kenji');
  });

  it('renders an empty state when no audio introductions are available', async () => {
    getAudioIntros.mockResolvedValueOnce([]);
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [AudioIntroFeedComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: { getAudioIntros } },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
            translations: signal({}),
          },
        },
      ],
    }).compileComponents();

    const emptyFixture = TestBed.createComponent(AudioIntroFeedComponent);
    emptyFixture.detectChanges();
    await emptyFixture.whenStable();
    emptyFixture.detectChanges();

    expect((emptyFixture.nativeElement as HTMLElement).textContent).toContain(
      'discovery.audioIntroFeed.noAudioIntros',
    );
  });

  it('distinguishes a load failure from an empty feed and retries', async () => {
    getAudioIntros.mockClear();
    getAudioIntros.mockRejectedValueOnce(new Error('service unavailable'));
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [AudioIntroFeedComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: { getAudioIntros } },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
            translations: signal({}),
          },
        },
      ],
    }).compileComponents();

    const errorFixture = TestBed.createComponent(AudioIntroFeedComponent);
    errorFixture.detectChanges();
    await errorFixture.whenStable();
    errorFixture.detectChanges();

    const element = errorFixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('common.error_generic');
    expect(element.textContent).not.toContain('discovery.audioIntroFeed.noAudioIntros');

    (element.querySelector('button') as HTMLButtonElement).click();
    errorFixture.detectChanges();
    await errorFixture.whenStable();
    errorFixture.detectChanges();

    expect(getAudioIntros).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain('Kenji');
  });

  it('does not create an audio player when the profile has no audio URL', async () => {
    await component.togglePlay('u1', undefined);

    expect(MockAudio.instances).toHaveLength(0);
    expect(component.playingId()).toBeNull();
  });

  it('renders a translated fallback for a profile without a display name', () => {
    expect(component.displayName(makeUser({ display_name: undefined }))).toBe(
      'common.unknownUser',
    );
  });

  it('localises language codes again when the active locale changes', () => {
    const english = component.formatLanguages(['ja', 'en']);
    currentLang.set('fr');
    const french = component.formatLanguages(['ja', 'en']);

    expect(english).toBe('Japanese, English');
    expect(french).toBe('japonais, anglais');
    expect(component.formatLanguages(['invalid_language_code'])).toBe(
      'invalid_language_code',
    );
  });

  it('only renders a language pair when both sides are present', () => {
    expect(component.hasLanguagePair(makeUser())).toBe(true);
    expect(component.hasLanguagePair(makeUser({ native_languages: [] }))).toBe(false);
    expect(component.hasLanguagePair(makeUser({ target_languages: [] }))).toBe(false);
  });

  it('plays and pauses the selected introduction with an action label', async () => {
    await component.togglePlay('u1', 'https://example.com/intro.mp3');
    fixture.detectChanges();

    expect(component.playingId()).toBe('u1');
    expect(MockAudio.instances).toHaveLength(1);
    expect(MockAudio.instances[0]?.play).toHaveBeenCalledOnce();

    const playButton = fixture.nativeElement.querySelector(
      'button[aria-label="audioIntro.pause"]',
    ) as HTMLButtonElement | null;
    expect(playButton?.getAttribute('aria-label')).toBe('audioIntro.pause');
    expect(playButton?.getAttribute('aria-describedby')).toBe('audio-intro-user-u1');
    expect(playButton?.getAttribute('aria-pressed')).toBeNull();
    expect(playButton?.getAttribute('size')).toBe('icon-touch');

    await component.togglePlay('u1', 'https://example.com/intro.mp3');
    expect(component.playingId()).toBeNull();
    expect(MockAudio.instances[0]?.pause).toHaveBeenCalledOnce();
  });

  it('clears playback state when the audio ends', async () => {
    await component.togglePlay('u1', 'https://example.com/intro.mp3');
    MockAudio.instances[0]?.emit('ended');

    expect(component.playingId()).toBeNull();
  });

  it('clears playback state when the browser pauses the audio', async () => {
    await component.togglePlay('u1', 'https://example.com/intro.mp3');
    MockAudio.instances[0]?.emit('pause');

    expect(component.playingId()).toBeNull();
  });

  it('surfaces a media error from the active player', async () => {
    await component.togglePlay('u1', 'https://example.com/intro.mp3');

    MockAudio.instances[0]?.emit('error');
    fixture.detectChanges();

    expect(component.playingId()).toBeNull();
    expect(component.playbackError()).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain('audioPlayer.error');
  });

  it('stops active playback when the component is destroyed', async () => {
    await component.togglePlay('u1', 'https://example.com/intro.mp3');
    const player = MockAudio.instances[0];

    fixture.destroy();

    expect(player?.pause).toHaveBeenCalledOnce();
    expect(component.playingId()).toBeNull();
  });

  it('surfaces playback failure and does not leave stale playing state', async () => {
    const failingPlay = vi.fn().mockRejectedValue(new Error('autoplay blocked'));

    class FailingAudio extends MockAudio {
      override readonly play = failingPlay;
    }
    vi.stubGlobal('Audio', FailingAudio);

    await component.togglePlay('u1', 'https://example.com/intro.mp3');
    fixture.detectChanges();

    expect(component.playingId()).toBeNull();
    expect(component.playbackError()).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain('audioPlayer.error');
  });

  it('ignores a stale playback rejection after a newer introduction starts', async () => {
    let rejectFirstPlay!: (error: Error) => void;
    const firstPlay = new Promise<void>((_resolve, reject) => {
      rejectFirstPlay = reject;
    });

    class RacingAudio extends MockAudio {
      override readonly play = vi.fn(() =>
        this.src.endsWith('/first.mp3') ? firstPlay : Promise.resolve(),
      );
    }
    vi.stubGlobal('Audio', RacingAudio);

    const firstToggle = component.togglePlay('u1', 'https://example.com/first.mp3');
    await component.togglePlay('u2', 'https://example.com/second.mp3');

    rejectFirstPlay(new Error('stale request failed'));
    await firstToggle;

    expect(component.playingId()).toBe('u2');
    expect(component.playbackError()).toBe(false);
  });

  it('ignores stale media errors after a newer introduction starts', async () => {
    await component.togglePlay('u1', 'https://example.com/first.mp3');
    await component.togglePlay('u2', 'https://example.com/second.mp3');

    MockAudio.instances[0]?.emit('error');

    expect(component.playingId()).toBe('u2');
    expect(component.playbackError()).toBe(false);
  });
});
