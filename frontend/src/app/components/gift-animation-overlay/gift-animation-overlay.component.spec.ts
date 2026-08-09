import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GiftAnimationOverlayComponent } from './gift-animation-overlay.component';
import { GiftAnimationService, GiftAnimationOverlay } from '../../services/gift-animation.service';
import { TranslatePipe } from '../../services/translate.pipe';


vi.mock('lottie-web', () => ({
  default: {
    loadAnimation: vi.fn(() => ({ destroy: vi.fn() })),
  },
}));

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
    const innerOverlay = fixture.nativeElement.querySelector('.fixed.inset-0');
    expect(innerOverlay).toBeNull();
  });

  it('should render Lottie container when animation is active', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.fixed.inset-0');
    expect(container).not.toBeNull();

    const lottieContainer = fixture.nativeElement.querySelector('#lottie-container');
    expect(lottieContainer).not.toBeNull();
  });

  it('should display gift icon and banners', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const iconEl = fixture.nativeElement.querySelector(".drop-shadow-lg");
    expect(iconEl).not.toBeNull();
    expect(iconEl.textContent.trim()).toBe('🌹');

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should have correct accessibility attributes', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('[role="alert"]');
    expect(container).not.toBeNull();
    expect(container.getAttribute('aria-live')).toBe('polite');
    expect(container.getAttribute('aria-label')).toBeTruthy();
  });

  it('should render Lottie container for confetti animation type', () => {
    animationService.playAnimation({ ...mockOverlay, animationType: 'confetti' });
    fixture.detectChanges();

    const lottieContainer = fixture.nativeElement.querySelector('#lottie-container');
    expect(lottieContainer).not.toBeNull();
  });

  it('should render Lottie container for hearts animation type', () => {
    animationService.playAnimation({ ...mockOverlay, animationType: 'hearts' });
    fixture.detectChanges();

    const lottieContainer = fixture.nativeElement.querySelector('#lottie-container');
    expect(lottieContainer).not.toBeNull();
  });

  it('should render Lottie container for sparkle animation type', () => {
    animationService.playAnimation({ ...mockOverlay, animationType: 'sparkle' });
    fixture.detectChanges();

    const lottieContainer = fixture.nativeElement.querySelector('#lottie-container');
    expect(lottieContainer).not.toBeNull();
  });

  it('should render Lottie container for premium animation type', () => {
    animationService.playAnimation({ ...mockOverlay, animationType: 'premium' });
    fixture.detectChanges();

    const lottieContainer = fixture.nativeElement.querySelector('#lottie-container');
    expect(lottieContainer).not.toBeNull();
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

  it('should show Lottie container when switching to a new animation', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    animationService.playAnimation({ ...mockOverlay, giftName: 'Heart' });
    fixture.detectChanges();

    const lottieContainer = fixture.nativeElement.querySelector('#lottie-container');
    expect(lottieContainer).not.toBeNull();
  });
});
