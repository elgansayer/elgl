import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DiscoveryRecommendation,
  RecommendationsService,
} from '../../../services/recommendations.service';
import { I18nService } from '../../../services/i18n.service';
import { StudyBuddiesService } from '../../../services/study-buddies.service';
import { RecommendedForYouCarouselComponent } from './recommended-for-you-carousel.component';

function recommendation(id: string, name = id): DiscoveryRecommendation {
  return {
    id,
    display_name: name,
    avatar_url: null,
    native_languages: ['ja'],
    target_languages: ['en'],
    shared_interest_count: 1,
    recommendation_reasons: ['language_exchange', 'shared_interests'],
  };
}

describe('RecommendedForYouCarouselComponent', () => {
  let fixture: ComponentFixture<RecommendedForYouCarouselComponent>;
  let component: RecommendedForYouCarouselComponent;
  let router: Router;
  let getRecommendations: ReturnType<typeof vi.fn>;
  let followUser: ReturnType<typeof vi.fn>;
  let getOrCreateChannel: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getRecommendations = vi.fn().mockResolvedValue([
      {
        ...recommendation('p-1', 'Aiko'),
        shared_interest_count: 2,
        recommendation_reasons: [
          'language_exchange',
          'shared_interests',
          'active_recently',
        ],
      },
      recommendation('p-2', 'Ren'),
    ]);
    followUser = vi.fn().mockResolvedValue(undefined);
    getOrCreateChannel = vi.fn().mockResolvedValue({ channel: 'room-1' });

    await TestBed.configureTestingModule({
      imports: [RecommendedForYouCarouselComponent],
      providers: [
        provideRouter([]),
        {
          provide: RecommendationsService,
          useValue: { getDiscoveryRecommendations: getRecommendations },
        },
        {
          provide: StudyBuddiesService,
          useValue: {
            follow: followUser,
            getOrCreateChannel,
          },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecommendedForYouCarouselComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  it('renders server order and explainable reasons without an internal score', () => {
    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.recommended-card'),
    ) as HTMLElement[];

    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Aiko');
    expect(cards[0].textContent).toContain('2 shared interests');
    expect(cards[0].textContent).toContain('Recently active');
    expect(component.recommendations()[0]).not.toHaveProperty('recommendation_score');
  });

  it('bounds the client contract to ten recommendations', async () => {
    getRecommendations.mockResolvedValueOnce(
      Array.from({ length: 12 }, (_, index) => recommendation(`p-${index}`)),
    );

    await component.load();

    expect(component.recommendations()).toHaveLength(10);
    expect(component.recommendations().at(-1)?.id).toBe('p-9');
  });

  it('keeps the newest load when overlapping requests finish out of order', async () => {
    let resolveStale!: (value: DiscoveryRecommendation[]) => void;
    const stale = new Promise<DiscoveryRecommendation[]>((resolve) => {
      resolveStale = resolve;
    });

    getRecommendations
      .mockReturnValueOnce(stale)
      .mockResolvedValueOnce([recommendation('fresh', 'Fresh match')]);

    const staleLoad = component.load();
    const freshLoad = component.load();
    await freshLoad;

    resolveStale([recommendation('stale', 'Stale match')]);
    await staleLoad;

    expect(component.recommendations().map((item) => item.id)).toEqual(['fresh']);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(false);
  });

  it('links recommendations to the canonical profile route', () => {
    const link = fixture.nativeElement.querySelector(
      '.recommended-profile-link',
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/profile/p-1');
  });

  it('renders direct Send Message and Follow actions for each recommendation', () => {
    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.recommended-card'),
    ) as HTMLElement[];

    for (const card of cards) {
      const actions = Array.from(card.querySelectorAll('button.recommended-action')) as HTMLButtonElement[];
      expect(actions).toHaveLength(2);
      expect(actions[0].textContent?.trim()).toBe('chat.sendMessage');
      expect(actions[1].textContent?.trim()).toBe('userProfile.follow');
    }
  });

  it('follows a recommended user once and exposes the completed state', async () => {
    await component.followUser('p-1');
    fixture.detectChanges();

    expect(followUser).toHaveBeenCalledWith('p-1');
    expect(component.isFollowing('p-1')).toBe(true);

    const followButton = fixture.nativeElement.querySelectorAll(
      'button.recommended-action',
    )[1] as HTMLButtonElement;
    expect(followButton.disabled).toBe(true);
    expect(followButton.getAttribute('aria-pressed')).toBe('true');
    expect(followButton.textContent?.trim()).toBe('userProfile.following');
  });

  it('suppresses duplicate follow mutations while the first request is pending', async () => {
    let resolveFollow!: () => void;
    followUser.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveFollow = resolve;
      }),
    );

    const first = component.followUser('p-1');
    const second = component.followUser('p-1');

    expect(followUser).toHaveBeenCalledTimes(1);
    resolveFollow();
    await Promise.all([first, second]);
    expect(component.isFollowing('p-1')).toBe(true);
  });

  it('opens a direct chat from the Send Message action', async () => {
    getOrCreateChannel.mockResolvedValueOnce({ channel: 'direct-p-1' });

    await component.sendMessage('p-1');

    expect(getOrCreateChannel).toHaveBeenCalledWith('p-1');
    expect(router.navigate).toHaveBeenCalledWith(['/chat', 'room', 'direct-p-1']);
    expect(component.hasActionError('p-1')).toBe(false);
  });

  it('surfaces a retryable action error without fabricating success', async () => {
    followUser.mockRejectedValueOnce(new Error('network'));

    await component.followUser('p-1');
    fixture.detectChanges();

    expect(component.isFollowing('p-1')).toBe(false);
    expect(component.hasActionError('p-1')).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    const followButton = fixture.nativeElement.querySelectorAll(
      'button.recommended-action',
    )[1] as HTMLButtonElement;
    expect(followButton.disabled).toBe(false);
  });

  it('supports arrow-key carousel navigation', () => {
    const scroll = vi.spyOn(component, 'scroll').mockImplementation(() => undefined);
    const carousel = fixture.nativeElement.querySelector('.recommended-carousel') as HTMLElement;

    carousel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(scroll).toHaveBeenCalledWith(1);
  });

  it('reverses logical arrow navigation in RTL', () => {
    document.documentElement.dir = 'rtl';
    const scroll = vi.spyOn(component, 'scroll').mockImplementation(() => undefined);
    const carousel = fixture.nativeElement.querySelector('.recommended-carousel') as HTMLElement;

    carousel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    carousel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(scroll).toHaveBeenNthCalledWith(1, 1);
    expect(scroll).toHaveBeenNthCalledWith(2, -1);
  });

  it('scrolls the next recommendation toward inline-end in RTL', () => {
    document.documentElement.dir = 'rtl';
    const carousel = fixture.nativeElement.querySelector('.recommended-carousel') as HTMLElement;
    const scrollBy = vi.fn();
    Object.defineProperty(carousel, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(carousel, 'scrollBy', { configurable: true, value: scrollBy });

    component.scroll(1);

    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({
        left: -300,
      }),
    );
  });

  it('shows an empty state when there are no eligible recommendations', async () => {
    getRecommendations.mockResolvedValueOnce([]);
    await component.load();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No recommendations yet');
    expect(fixture.nativeElement.querySelector('.recommended-card')).toBeNull();
  });

  it('shows a retryable error state without discarding the page', async () => {
    getRecommendations.mockRejectedValueOnce(new Error('network'));
    await component.load();
    fixture.detectChanges();

    expect(component.error()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Recommendations are unavailable');
    expect(fixture.nativeElement.querySelector('.recommended-retry')).toBeTruthy();
  });
});
