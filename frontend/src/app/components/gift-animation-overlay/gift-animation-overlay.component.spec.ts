import { ComponentFixture, TestBed } from '@angular/core/testing';
import lottie from 'lottie-web';
import { GiftAnimationOverlayComponent } from './gift-animation-overlay.component';
import { GiftAnimationOverlay, GiftAnimationService } from '../../services/gift-animation.service';
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
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });

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

  it('should display the decorative gift icon and dismiss control', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const iconEl = fixture.nativeElement.querySelector('span[aria-hidden="true"]');
    expect(iconEl).not.toBeNull();
    expect(iconEl.textContent.trim()).toBe('🌹');

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(1);
  });

  it('should expose the notification and translated dismiss name', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('[role="alert"]');
    expect(container).not.toBeNull();
    expect(container.getAttribute('aria-live')).toBe('polite');
    expect(container.getAttribute('aria-label')).toBeTruthy();

    const dismissBtn = fixture.nativeElement.querySelector('button');
    expect(dismissBtn.getAttribute('aria-label')).toBe('Close');
  });

  it('should use Relay semantic colour roles instead of physical black/white utilities', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const html = fixture.nativeElement.innerHTML;
    expect(html).toContain('bg-surface-900/40');
    expect(html).toContain('from-accent');
    expect(html).toContain('to-vip');
    expect(html).not.toContain('bg-black');
    expect(html).not.toContain('bg-white');
    expect(html).not.toContain('text-white');
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

  it('should have the Relay enter animation class on the banner', () => {
    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.gift-animation-banner-visible');
    expect(banner).not.toBeNull();
  });

  it('should suppress script-driven Lottie motion for reduced-motion users', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);

    animationService.playAnimation(mockOverlay);
    fixture.detectChanges();

    expect(lottie.loadAnimation).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
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
