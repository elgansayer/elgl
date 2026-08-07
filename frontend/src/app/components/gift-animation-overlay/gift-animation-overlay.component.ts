import { Component, inject, computed } from '@angular/core';
import { GiftAnimationService } from '../../services/gift-animation.service';
import { TranslatePipe } from '../../services/translate.pipe';

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
        [attr.aria-label]="'gift.broadcastDesc' | t: { sender: anim.senderName, receiver: anim.receiverName, giftName: anim.giftName, cost: anim.coinValue }"
      >
        <!-- Full-screen SVG animation layer -->
        <div class="absolute inset-0 z-0" aria-hidden="true">
          @switch (anim.animationType) {
            @case ('confetti') {
              <svg class="w-full h-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
                @for (i of confettiPieces(); track i.id) {
                  <rect
                    [attr.x]="i.x"
                    [attr.y]="i.y"
                    [attr.width]="i.size"
                    [attr.height]="i.size"
                    [attr.fill]="i.colour"
                    [attr.rx]="i.rounded"
                    [attr.transform]="'rotate(' + i.rotation + ' ' + (i.x + i.size/2) + ' ' + (i.y + i.size/2) + ')'"
                    class="confetti-piece"
                    [style.animation-delay.ms]="i.delay"
                    [style.animation-duration.ms]="i.duration"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      [attr.from]="'0 0'"
                      [attr.to]="'0 ' + (800 - i.y)"
                      [attr.dur]="i.duration + 'ms'"
                      repeatCount="1"
                    />
                  </rect>
                }
              </svg>
            }
            @case ('hearts') {
              <svg class="w-full h-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
                @for (heart of heartParticles(); track heart.id) {
                  <g [style.animation-delay.ms]="heart.delay">
                    <path
                      [attr.d]="heartPath"
                      [attr.fill]="heart.colour"
                      [attr.transform]="'translate(' + heart.x + ', ' + heart.y + ') scale(' + heart.scale + ')'"
                      class="heart-particle"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="translate"
                        [attr.from]="heart.x + ' ' + heart.y"
                        [attr.to]="heart.x + ' ' + (800 - heart.toY)"
                        [attr.dur]="heart.duration + 'ms'"
                        repeatCount="1"
                      />
                    </path>
                  </g>
                }
              </svg>
            }
            @case ('sparkle') {
              <svg class="w-full h-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
                @for (star of sparkleParticles(); track star.id) {
                  <g [style.animation-delay.ms]="star.delay">
                    <polygon
                      [attr.points]="star.points"
                      [attr.fill]="star.colour"
                      [attr.transform]="'translate(' + star.x + ', ' + star.y + ') scale(' + star.scale + ')'"
                      class="sparkle-particle"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        [attr.from]="'0 ' + star.x + ' ' + star.y"
                        [attr.to]="'360 ' + star.x + ' ' + star.y"
                        [attr.dur]="star.spinDuration + 'ms'"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="1;0.2;1"
                        [attr.dur]="star.pulseDuration + 'ms'"
                        repeatCount="indefinite"
                      />
                    </polygon>
                  </g>
                }
              </svg>
            }
            @case ('premium') {
              <svg class="w-full h-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="premiumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#FFD700" />
                    <stop offset="50%" style="stop-color:#FFA500" />
                    <stop offset="100%" style="stop-color:#FFD700" />
                  </linearGradient>
                  <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style="stop-color:#FFD700;stop-opacity:0.6" />
                    <stop offset="100%" style="stop-color:#FFD700;stop-opacity:0" />
                  </radialGradient>
                </defs>
                @for (ring of premiumRings(); track ring.id) {
                  <circle
                    [attr.cx]="ring.cx"
                    [attr.cy]="ring.cy"
                    [attr.r]="ring.r"
                    fill="none"
                    stroke="url(#premiumGrad)"
                    [attr.stroke-width]="ring.strokeWidth"
                    class="premium-ring"
                    [style.animation-delay.ms]="ring.delay"
                  >
                    <animate
                      attributeName="r"
                      [attr.from]="ring.r"
                      [attr.to]="ring.r * 6"
                      [attr.dur]="ring.duration + 'ms'"
                      repeatCount="1"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;0"
                      [attr.dur]="ring.duration + 'ms'"
                      repeatCount="1"
                    />
                  </circle>
                }
              </svg>
            }
            @default {
              <svg class="w-full h-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
                @for (item of floatParticles(); track item.id) {
                  <g [style.animation-delay.ms]="item.delay">
                    <text
                      [attr.x]="item.x"
                      [attr.y]="item.y"
                      [attr.font-size]="item.fontSize"
                      text-anchor="middle"
                      class="float-particle"
                    >{{ item.emoji }}</text>
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      [attr.from]="'0 0'"
                      [attr.to]="'0 ' + (-800)"
                      [attr.dur]="item.duration + 'ms'"
                      repeatCount="1"
                    />
                  </g>
                }
              </svg>
            }
          }
        </div>

        <!-- Central gift banner -->
        <div
          class="relative z-10 flex flex-col items-center gap-3"
          [class.animate-zoom-in]="animationService.isVisible()"
        >
          <div class="bg-gradient-to-r from-amber-500 via-purple-600 to-amber-500 text-white px-4 sm:px-8 py-4 sm:py-6 rounded-3xl shadow-2xl border-4 border-amber-500/30 flex flex-col items-center gap-2 max-w-[90vw]">
            <span class="text-5xl sm:text-7xl filter drop-shadow-lg">{{ anim.giftIcon }}</span>
            <h3 class="text-lg sm:text-2xl font-black tracking-wide text-center">
              {{ 'gift.broadcastTitle' | t: { giftName: anim.giftName } }}
            </h3>
            <p class="text-xs sm:text-sm font-extrabold text-amber-100 text-center">              {{
                'gift.broadcastDesc'
                  | t
                    : {
                        sender: anim.senderName,
                        receiver: anim.receiverName,
                        giftName: anim.giftName,
                        cost: anim.coinValue,                      }
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
      .confetti-piece,
      .heart-particle,
      .sparkle-particle,
      .float-particle,
      .premium-ring {
        will-change: transform, opacity;      }
    `,
  ],
})
export class GiftAnimationOverlayComponent {
  readonly animationService = inject(GiftAnimationService);

  readonly heartPath =
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

  private readonly colours = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#FFD700', '#FF69B4',
    '#00CED1', '#FF8C00', '#98D8C8', '#F7DC6F',
  ];

  // Particles are derived from the animation signal so they regenerate on each new gift
  readonly confettiPieces = computed(() => {
    const anim = this.animationService.currentAnimation();
    const animId = anim?.id ?? 'default';
    return Array.from({ length: 40 }, (_, i) => ({
      id: `${animId}-cf-${i}`,
      x: Math.random() * 600,
      y: -20 - Math.random() * 200,
      size: 8 + Math.random() * 14,
      colour: this.colours[i % this.colours.length],
      rounded: Math.random() > 0.5 ? 4 : 0,
      rotation: Math.random() * 360,
      delay: Math.random() * 500,
      duration: 2000 + Math.random() * 3000,
    }));
  });

  readonly heartParticles = computed(() => {
    const anim = this.animationService.currentAnimation();
    const animId = anim?.id ?? 'default';
    const heartColours = ['#FF6B6B', '#FF69B4', '#FF1493', '#C71585', '#FF4500'];
    return Array.from({ length: 20 }, (_, i) => ({
      id: `${animId}-hr-${i}`,
      x: 100 + Math.random() * 400,
      y: -30 - Math.random() * 100,
      toY: 50 + Math.random() * 100,
      colour: heartColours[i % 5],
      scale: 0.5 + Math.random() * 1.5,
      delay: Math.random() * 1000,
      duration: 2500 + Math.random() * 3000,
    }));
  });

  readonly sparkleParticles = computed(() => {
    const anim = this.animationService.currentAnimation();
    const animId = anim?.id ?? 'default';
    const sparkleColours = ['#FFD700', '#FFFACD', '#FFA500', '#FFB6C1', '#87CEEB'];
    return Array.from({ length: 25 }, (_, i) => {
      const cx = Math.random() * 600;
      const cy = Math.random() * 800;
      const size = 10 + Math.random() * 20;
      return {
        id: `${animId}-sp-${i}`,
        x: cx,
        y: cy,
        points: this.starPoints(cx, cy, size),
        colour: sparkleColours[i % 5],
        scale: 0.5 + Math.random() * 1,
        delay: Math.random() * 2000,
        spinDuration: 2000 + Math.random() * 3000,
        pulseDuration: 800 + Math.random() * 1200,
      };
    });
  });

  readonly premiumRings = computed(() => {
    const anim = this.animationService.currentAnimation();
    const animId = anim?.id ?? 'default';
    return Array.from({ length: 5 }, (_, i) => ({
      id: `${animId}-ring-${i}`,
      cx: 300,
      cy: 400,
      r: 40 + i * 25,
      strokeWidth: 2 + i * 0.5,
      delay: i * 300,
      duration: 2500 + i * 400,
    }));
  });

  readonly floatParticles = computed(() => {
    const anim = this.animationService.currentAnimation();
    const animId = anim?.id ?? 'default';
    const emojis = ['🎁', '✨', '🌟', '💎', '🎀', '💝', '🌸', '🎊'];
    return Array.from({ length: 15 }, (_, i) => ({
      id: `${animId}-fl-${i}`,
      x: 50 + Math.random() * 500,
      y: 750 + Math.random() * 100,
      emoji: emojis[i % emojis.length],
      fontSize: 24 + Math.random() * 40,
      delay: Math.random() * 1500,
      duration: 3000 + Math.random() * 4000,
    }));
  });

  private starPoints(cx: number, cy: number, size: number): string {
    const outerR = size;
    const innerR = size * 0.4;
    const points = 5;
    const coords: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI / 2) * -1 + (Math.PI / points) * i;
      const r = i % 2 === 0 ? outerR : innerR;
      coords.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return coords.join(' ');
  }
}
// SVG gift animation implementation for issue #423
