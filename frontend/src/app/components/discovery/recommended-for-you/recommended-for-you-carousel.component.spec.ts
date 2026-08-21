import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationsService } from '../../../services/recommendations.service';
import { RecommendedForYouCarouselComponent } from './recommended-for-you-carousel.component';

describe('RecommendedForYouCarouselComponent', () => {
  let fixture: ComponentFixture<RecommendedForYouCarouselComponent>;
  let component: RecommendedForYouCarouselComponent;
  let getRecommendations: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getRecommendations = vi.fn().mockResolvedValue([
      {
        id: 'p-1',
        display_name: 'Aiko',
        avatar_url: null,
        native_languages: ['ja'],
        target_languages: ['en'],
        shared_interest_count: 2,
        recommendation_reasons: [
          'language_exchange',
          'shared_interests',
          'active_recently',
        ],
      },
      {
        id: 'p-2',
        display_name: 'Ren',
        avatar_url: null,
        native_languages: ['ja'],
        target_languages: ['en'],
        shared_interest_count: 1,
        recommendation_reasons: ['language_exchange', 'shared_interests'],
      },
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
