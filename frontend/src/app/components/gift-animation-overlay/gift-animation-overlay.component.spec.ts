import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideLottieOptions } from 'ngx-lottie';

import { GiftAnimationOverlayComponent } from './gift-animation-overlay.component';
import { GiftAnimationService, GiftAnimationOverlay } from '../../services/gift-animation.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('GiftAnimationOverlayComponent', () => {
  let fixture: ComponentFixture<GiftAnimationOverlayComponent>;
  let component: GiftAnimationOverlayComponent;
  let animationService: GiftAnimationService;

  const mockOverlay: GiftAnimationOverlay = {
    id: 'test-gift',
    giftName: 'Rose',
    giftIcon: '🌹',
    animationType: 'float',
    senderName: 'Sender',
    receiverName: 'Receiver',
    coinValue: 10,
  };

  const mockTranslatePipe = {
    transform: (key: string, _params?: Record<string, unknown>) => `[${key}]`,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GiftAnimationOverlayComponent],
      providers: [
        provideLottieOptions({ player: () => ({ loadAnimation: () => ({}) }) as unknown as typeof import('lottie-web').default }),
        {
          provide: TranslatePipe,
          useValue: mockTranslatePipe,
        },
      ],
    });
    fixture = TestBed.createComponent(GiftAnimationOverlayComponent);
    component = fixture.componentInstance;
    animationService = TestBed.inject(GiftAnimationService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render when no animation is active', () => {
    const overlay = fixture.nativeElement.querySelector('.fixed.inset-0');
    expect(overlay).toBeNull();
  });

  it('should render SVG animation when animation is active', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.fixed.inset-0');
    expect(container).not.toBeNull();

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('should display gift icon fallback when no Lottie URL is available', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const iconEl = fixture.nativeElement.querySelector('.text-7xl');
    expect(iconEl).toBeTruthy();
    expect(iconEl.textContent.trim()).toBe('🌹');

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render ng-lottie when animationUrl is present', () => {
    animationService.playAnimation({ ...mockOverlay, animationUrl: 'assets/test.json' });
    fixture.detectChanges();

    const lottieEl = fixture.nativeElement.querySelector('ng-lottie');
    expect(lottieEl).not.toBeNull();
  });

  it('should have correct accessibility attributes', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('[role="alert"]');
    expect(container).not.toBeNull();
    expect(container.getAttribute('aria-live')).toBe('polite');
    expect(container.getAttribute('aria-label')).toBeTruthy();
  });

  it('should render confetti animation type', () => {
    animationService.playAnimation({ ...mockOverlay, animationType: 'confetti' });
    fixture.detectChanges();

    const rects = fixture.nativeElement.querySelectorAll('rect.confetti-piece');
    expect(rects.length).toBe(40);
  });

  it('should render hearts animation type', () => {
    animationService.playAnimation({ ...mockOverlay, animationType: 'hearts' });
    fixture.detectChanges();

    const hearts = fixture.nativeElement.querySelectorAll('path.heart-particle');
    expect(hearts.length).toBe(20);
  });

  it('should render sparkle animation type', () => {
    animationService.playAnimation({ ...mockOverlay, animationType: 'sparkle' });
    fixture.detectChanges();

    const stars = fixture.nativeElement.querySelectorAll('polygon.sparkle-particle');
    expect(stars.length).toBe(25);
  });

  it('should render premium animation type', () => {
    animationService.playAnimation({ ...mockOverlay, animationType: 'premium' });
    fixture.detectChanges();

    const rings = fixture.nativeElement.querySelectorAll('circle.premium-ring');
    expect(rings.length).toBe(5);
  });

  it('should dismiss animation when button is clicked', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const dismissBtn = fixture.nativeElement.querySelector('button');
    dismissBtn.click();
    fixture.detectChanges();

    expect(animationService.isVisible()).toBe(false);
  });

  it('should fade out when isVisible is false', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    animationService.isVisible.set(false);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.fixed.inset-0');
    expect(container.classList.contains('opacity-0')).toBe(true);
  });

  it('should have zoom-in animation class on the banner', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.animate-zoom-in');
    expect(banner).not.toBeNull();
  });

  it('should regenerate particles for new animations', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    animationService.playAnimation({ ...mockOverlay, giftName: 'Heart' });
    fixture.detectChanges();

    const secondFloat = fixture.nativeElement.querySelector('.float-particle');
    expect(secondFloat).not.toBeNull();
  });

  it('should use built-in gift_heart animation URL', () => {
    animationService.playAnimation({ ...mockOverlay, id: 'gift_heart', animationUrl: undefined });
    fixture.detectChanges();

    const lottieEl = fixture.nativeElement.querySelector('ng-lottie');
    expect(lottieEl).not.toBeNull();
  });
});