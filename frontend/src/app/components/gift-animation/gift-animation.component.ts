import { Component, computed, input } from '@angular/core';
import { GiftPayload, isGiftPayload } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';

const PARTICLE_COLOURS = [
  'rgb(var(--color-accent-rgb))',
  'rgb(var(--color-vip-rgb))',
  'rgb(var(--color-primary-rgb))',
  'rgb(var(--color-secondary-rgb))',
];

@Component({
  selector: 'app-gift-animation',
  imports: [TranslatePipe],
  template: `
    @if (gift(); as gift) {
      <div
        class="gift-bubble inline-flex min-w-36 flex-col items-center rounded-card border border-vip/30 bg-gradient-to-br from-vip/20 via-surface-200 to-accent/20 p-2 shadow-card"
        role="status"
        aria-live="polite"
        [attr.aria-label]="
          'gift.broadcastDesc'
            | t
              : {
                  sender: (gift.sender_name ?? 'gift.someone' | t),
                  receiver: (gift.receiver_name ?? 'gift.you' | t),
                  giftName: gift.gift_name,
                  cost: gift.coin_value,
                }
        "
      >
        <div class="relative mb-1">
          <span class="gift-icon inline-block text-4xl drop-shadow-lg" aria-hidden="true">
            {{ gift.gift_icon }}
          </span>
          <svg
            class="gift-particles pointer-events-none absolute -inset-2"
            viewBox="0 0 60 60"
            aria-hidden="true"
          >
            @for (p of particles(); track p.id) {
              <circle
                [attr.cx]="p.x"
                [attr.cy]="p.y"
                [attr.r]="p.size"
                [attr.fill]="p.colour"
                [attr.opacity]="0.9"
                class="gift-particle"
                [style.animation-delay.s]="p.delay"
                [style.animation-duration.s]="p.duration"
              />
            }
          </svg>
        </div>
        <span class="text-center text-xs font-bold text-text-primary">{{ gift.gift_name }}</span>
        <span class="flex items-center gap-1 text-[10px] font-semibold text-vip">
          <span class="inline-block size-3 rounded-full bg-vip" aria-hidden="true"></span>
          {{ 'gift.coinValue' | t: { cost: gift.coin_value } }}
        </span>
      </div>
    } @else {
      <div
        class="inline-flex min-w-36 items-center justify-center rounded-card border border-surface-100 bg-surface-200 p-3 text-xs text-text-secondary"
        role="status"
      >
        {{ 'gift.unavailable' | t }}
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: inline-block;
        max-width: 100%;
      }
      .gift-icon {
        animation: gift-bounce 1.2s var(--app-ease-standard) infinite alternate;
      }
      @keyframes gift-bounce {
        from {
          transform: translateY(0) scale(1);
        }
        to {
          transform: translateY(-6px) scale(1.1);
        }
      }
      .gift-particle {
        animation: particleFadeUp linear forwards;
      }
      @keyframes particleFadeUp {
        0% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translateY(-20px) scale(0.3);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .gift-icon {
          animation: none;
        }

        .gift-particles {
          display: none;
        }
      }

      @media (forced-colors: active) {
        .gift-bubble {
          border-color: CanvasText;
          background: Canvas;
          box-shadow: none;
          color: CanvasText;
        }
      }
    `,
  ],
})
export class GiftAnimationComponent {
  readonly giftPayload = input<GiftPayload | null>();
  readonly gift = computed(() => {
    const payload = this.giftPayload();
    return isGiftPayload(payload) ? payload : null;
  });

  private readonly colours = PARTICLE_COLOURS;

  readonly particles = computed(() => {
    const payload = this.gift();
    if (!payload) return [];
    const idSeed = payload.gift_id + payload.gift_name;
    // Deterministic pseudo-random based on gift_id for stable particle positions
    const seed = Array.from(idSeed).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const pseudoRandom = (n: number) => {
      let s = seed + n * 16807;
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 10 + pseudoRandom(i * 3) * 40,
      y: 10 + pseudoRandom(i * 3 + 1) * 40,
      size: 2 + pseudoRandom(i * 3 + 2) * 3,
      colour: this.colours[i % this.colours.length],
      rotation: pseudoRandom(i * 3 + 3) * 360,
      delay: pseudoRandom(i * 3 + 4) * 1.5,
      duration: 1.2 + pseudoRandom(i * 3 + 5) * 1.5,
    }));
  });
}
