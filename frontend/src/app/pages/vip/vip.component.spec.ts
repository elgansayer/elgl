import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { VipComponent } from './vip.component';
import { I18nService } from '../../services/i18n.service';

describe.skip('VipComponent', () => {
  let component: VipComponent;
  let fixture: ComponentFixture<VipComponent>;
  let router: Router;

  const mockI18nService = {
    translate: (key: string) => key,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VipComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VipComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a card for each plan', () => {
    const cards = fixture.nativeElement.querySelectorAll('#plans app-card');
    expect(cards.length).toBe(component.plans().length);
  });

  it('marks the popular plan with a "most popular" pill', () => {
    const pills = fixture.nativeElement.querySelectorAll('#plans app-pill');
    expect(pills.length).toBe(component.plans().filter((plan) => plan.isPopular).length);
  });

  it('renders a comparison table row for each benefit', () => {
    const rows = fixture.nativeElement.querySelectorAll('#comparison tbody tr');
    expect(rows.length).toBe(component.benefitRows().length);
  });

  it('renders a FAQ entry for each item, collapsed by default', () => {
    const questions = fixture.nativeElement.querySelectorAll('button[aria-expanded]');
    expect(questions.length).toBe(component.faqItems().length);
    questions.forEach((button: HTMLButtonElement) => {
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('toggles a FAQ answer open and closed when clicked', () => {
    expect(component.openFaqIndex()).toBeNull();

    component.toggleFaq(0);
    fixture.detectChanges();
    expect(component.openFaqIndex()).toBe(0);

    const answer = fixture.nativeElement.querySelector(
      'button[aria-expanded="true"]',
    );
    expect(answer).toBeTruthy();

    component.toggleFaq(0);
    fixture.detectChanges();
    expect(component.openFaqIndex()).toBeNull();
  });

  it('only keeps one FAQ item open at a time', () => {
    component.toggleFaq(0);
    component.toggleFaq(1);
    fixture.detectChanges();

    expect(component.openFaqIndex()).toBe(1);
  });

  it('scrolls to the plans section', () => {
    const scrollSpy = vi.fn();
    vi.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: scrollSpy,
    } as unknown as HTMLElement);

    component.scrollToPlans();

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth' });

    vi.restoreAllMocks();
  });

  it('navigates home when starting the free plan', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.onStartFree();

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('navigates home when continuing on the free plan from the CTA section', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.onContinueFree();

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  describe.skip('onSubscribe', () => {
    it('navigates home when subscribing to the free plan', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.onSubscribe('free');

      expect(navigateSpy).toHaveBeenCalledWith(['/']);
    });

    it('navigates to the subscription checkout page for a paid plan', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.onSubscribe('consumer');

      expect(navigateSpy).toHaveBeenCalledWith(['/subscription']);
    });
  });
});
