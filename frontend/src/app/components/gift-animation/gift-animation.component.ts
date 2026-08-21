import { Component, input, computed } from '@angular/core';
import { GiftPayload } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';

const PARTICLE_COLOURS = [
  '#f43f5e',
  '#ec4899',
  '#d946ef',
  '#a855f7',
  '#8b5cf6',
  '#f59e0b',
  '#fbbf24',
  '#facc15',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
];

@Component({
  selector: 'app-gift-animation',
  imports: [TranslatePipe],
  template: `
    @if (giftPayload(); as gift) {
      <div
        class="gift-bubble inline-flex flex-col items-center bg-gradient-to-br from-vip/40 via-neon-violet/30 to-accent/40 rounded-xl p-2 border border-vip/20 min-w-[140px]"
        role="status"
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
        <!-- Animated gift icon with glow -->
        <div class="relative mb-1">
          <span
            class="text-4xl filter drop-shadow-lg animate-bounce-subtle inline-block"
            [style.animation-delay.ms]="0"
            >{{ gift.gift_icon }}</span
          >
          <!-- Mini sparkle particles -->
          <svg class="absolute -inset-2 pointer-events-none" viewBox="0 0 60 60" aria-hidden="true">
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
        <!-- Gift name and coin value -->
        <span class="text-xs font-bold text-vip text-center">{{ gift.gift_name }}</span>
        <span class="text-[10px] text-vip/70 flex items-center gap-1">
          <span class="inline-block w-3 h-3 rounded-full bg-vip"></span>
          {{ gift.coin_value }}
        </span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: inline-block;
        max-width: 75%;
      }
      .animate-bounce-subtle {
        animation: bounceSubtle 1.2s ease-in-out infinite;
      }
      @keyframes bounceSubtle {
        0%,
        100% {
          transform: translateY(0) scale(1);
        }
        50% {
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
      .gift-bubble {
        box-shadow:
          0 0 20px rgba(245, 158, 11, 0.15),
          0 0 40px rgba(168, 85, 247, 0.08);
      }
    `,
  ],
})
export class GiftAnimationComponent {
  readonly giftPayload = input<GiftPayload>();

  private readonly colours = PARTICLE_COLOURS;

  readonly particles = computed(() => {
    const payload = this.giftPayload();
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
