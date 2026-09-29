import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DiscoveryRecommendation,
  RecommendationsService,
} from '../../../services/recommendations.service';
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
  let getRecommendations: ReturnType<typeof vi.fn>;

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

    await TestBed.configureTestingModule({
      imports: [RecommendedForYouCarouselComponent],
      providers: [
        provideRouter([]),
        {
          provide: RecommendationsService,
          useValue: { getDiscoveryRecommendations: getRecommendations },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecommendedForYouCarouselComponent);
    component = fixture.componentInstance;
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
    const link = fixture.nativeElement.querySelector('.recommended-card') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/profile/p-1');
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
