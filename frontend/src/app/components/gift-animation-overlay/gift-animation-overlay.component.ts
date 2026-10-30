import { Component, computed, inject } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import confettiData from '../../animations/confetti.data';
import floatData from '../../animations/float.data';
import heartsData from '../../animations/hearts.data';
import premiumData from '../../animations/premium.data';
import sparkleData from '../../animations/sparkle.data';
import { GiftAnimationService, GiftAnimationType } from '../../services/gift-animation.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { LottiePlayerComponent } from '../primitives/lottie-player/lottie-player.component';

const DEFAULT_ANIMATION_DATA: Record<GiftAnimationType, unknown> = {
  confetti: confettiData,
  hearts: heartsData,
  sparkle: sparkleData,
  premium: premiumData,
  float: floatData,
};

@Component({
  selector: 'app-gift-animation-overlay',
  imports: [HlmButton, LottiePlayerComponent, TranslatePipe],
  template: `
    @if (animationService.currentAnimation(); as anim) {
      <div
        class="gift-animation-overlay fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none"
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
        <div class="absolute inset-0 z-0 bg-surface-900/40" aria-hidden="true">
          <div id="lottie-container" class="w-full h-full">
            @if (!prefersReducedMotion()) {
              <app-lottie-player
                class="w-full h-full"
                [animationData]="animationData()"
                [loop]="false"
                [playbackKey]="anim.id"
              />
            }
          </div>
        </div>

        <div
          class="gift-animation-banner relative z-10 flex flex-col items-center gap-3"
          [class.gift-animation-banner-visible]="animationService.isVisible()"
        >
          <div
            class="bg-gradient-to-r from-accent to-vip text-on-fill px-4 sm:px-8 py-4 sm:py-6 rounded-sheet shadow-lift border border-accent/30 flex flex-col items-center gap-2 max-w-[calc(100vw-2rem)] sm:max-w-[90vw]"
          >
            <span class="text-5xl sm:text-7xl" aria-hidden="true">{{ anim.giftIcon }}</span>
            <h3 class="text-lg sm:text-2xl font-black tracking-wide text-center">
              {{ 'gift.broadcastTitle' | t: { giftName: anim.giftName } }}
            </h3>
            <p class="text-xs sm:text-sm font-extrabold text-on-fill/85 text-center">
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

          <button
            hlmBtn
            variant="secondary"
            size="icon-touch"
            class="pointer-events-auto shadow-card"
            [attr.aria-label]="'common.close' | t"
            (click)="animationService.dismiss()"
          >
            <span aria-hidden="true">✕</span>
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

      .gift-animation-overlay {
        transition: opacity var(--app-motion-slow) var(--app-ease-standard);
      }

      .gift-animation-banner-visible {
        animation: gift-overlay-enter var(--app-motion-slow) var(--app-ease-standard) forwards;
      }

      @keyframes gift-overlay-enter {
        from {
          opacity: 0;
          transform: scale(0.94);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .gift-animation-overlay {
          transition: none;
        }

        .gift-animation-banner-visible {
          animation: none;
        }
      }
    `,
  ],
})
export class GiftAnimationOverlayComponent {
  readonly animationService = inject(GiftAnimationService);
  readonly animationData = computed(() => {
    const animationType = this.animationService.currentAnimation()?.animationType ?? 'float';
    return DEFAULT_ANIMATION_DATA[animationType] ?? DEFAULT_ANIMATION_DATA['float'];
  });

  prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
