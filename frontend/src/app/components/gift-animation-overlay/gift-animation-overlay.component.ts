import { Component, inject, effect, DestroyRef } from '@angular/core';
import lottie, { AnimationItem } from 'lottie-web';
import { GiftAnimationService, GiftAnimationType } from '../../services/gift-animation.service';
import { TranslatePipe } from '../../services/translate.pipe';
import confettiData from '../../animations/confetti.data';
import heartsData from '../../animations/hearts.data';
import sparkleData from '../../animations/sparkle.data';
import premiumData from '../../animations/premium.data';
import floatData from '../../animations/float.data';

const DEFAULT_ANIMATION_DATA: Record<GiftAnimationType, unknown> = {
  confetti: confettiData,
  hearts: heartsData,
  sparkle: sparkleData,
  premium: premiumData,
  float: floatData,
};

@Component({
  selector: 'app-gift-animation-overlay',
  imports: [TranslatePipe],
  template: `
    @if (animationService.currentAnimation(); as anim) {
      <div
        class="fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none transition-opacity duration-600"
        [class.opacity-0]="!animationService.isVisible()"
        role="alert"
        aria-live="polite"
        [attr.aria-label]="
          'gift.broadcastDesc'
            | t
              : {
                  sender: anim.senderName,
                  receiver: anim.receiverName,
                  giftName: anim.giftName,
                  cost: anim.coinValue,
                }
        "
      >
        <!-- Full-screen Lottie animation layer -->
        <div class="absolute inset-0 z-0 bg-black/30" aria-hidden="true">
          <div id="lottie-container" class="w-full h-full"></div>
        </div>

        <!-- Central gift banner -->
        <div
          class="relative z-10 flex flex-col items-center gap-3"
          [class.animate-zoom-in]="animationService.isVisible()"
        >
          <div
            class="bg-gradient-to-r from-vip via-accent to-neon-orange text-on-fill px-4 sm:px-8 py-4 sm:py-6 rounded-3xl shadow-2xl border-4 border-vip/30 flex flex-col items-center gap-2 max-w-[90vw]"
          >
            <span class="text-5xl sm:text-7xl filter drop-shadow-lg">{{ anim.giftIcon }}</span>
            <h3 class="text-lg sm:text-2xl font-black tracking-wide text-center">
              {{ 'gift.broadcastTitle' | t: { giftName: anim.giftName } }}
            </h3>
            <p class="text-xs sm:text-sm font-extrabold text-on-fill/80 text-center">
              {{
                'gift.broadcastDesc'
                  | t
                    : {
                        sender: anim.senderName,
                        receiver: anim.receiverName,
                        giftName: anim.giftName,
                        cost: anim.coinValue,
                      }
              }}
            </p>
          </div>
          <!-- Dismiss button -->
          <button
            class="pointer-events-auto rounded-full bg-white/20 px-5 py-2 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
            (click)="animationService.dismiss()"
          >
            ✕
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .transition-opacity.duration-600 {
        transition: opacity 600ms ease-in-out;
      }
      .animate-zoom-in {
        animation: zoomIn 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      }
      @keyframes zoomIn {
        from {
          opacity: 0;
          transform: scale(0.5);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `,
  ],
})
export class GiftAnimationOverlayComponent {
  readonly animationService = inject(GiftAnimationService);
  private readonly destroyRef = inject(DestroyRef);

  private lottieAnimation: AnimationItem | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.destroyLottie());

    effect(() => {
      const anim = this.animationService.currentAnimation();
      if (anim) {
        const container = document.getElementById('lottie-container');
        if (container) {
          this.loadLottieAnimation(container, anim.animationType);
        }
      } else {
        this.destroyLottie();
      }
    });
  }

  private loadLottieAnimation(container: HTMLElement, animationType: GiftAnimationType): void {
    this.destroyLottie();

    const data = DEFAULT_ANIMATION_DATA[animationType] ?? DEFAULT_ANIMATION_DATA['float'];
    if (!data) return;

    this.lottieAnimation = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData: data,
    });
  }

  private destroyLottie(): void {
    if (this.lottieAnimation) {
      this.lottieAnimation.destroy();
      this.lottieAnimation = null;
    }
  }
}
