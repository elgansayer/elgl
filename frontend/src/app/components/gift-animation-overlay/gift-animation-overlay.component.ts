import { Component, computed, inject } from '@angular/core';
import { EconomyStore } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-gift-animation-overlay',
  imports: [TranslatePipe],
  template: `
    @if (store.activeGiftAnimation(); as overlay) {
      <div class="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        <!-- Full-screen SVG animation layer -->
        <svg class="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          @switch (overlay.gift.animation_type) {
            @case ('confetti') {
              <g class="confetti-group">
                @for (i of confettiPieces(); track i.id) {
                  <rect
                    [attr.x]="i.x + '%'"
                    [attr.y]="i.y + '%'"
                    [attr.width]="i.size + 'px'"
                    [attr.height]="i.size + 'px'"
                    [attr.fill]="i.colour"
                    [attr.rx]="i.size / 4 + 'px'"
                    [style.animation-name]="'confettiFall'"
                    [style.animation-duration.ms]="i.duration"
                    [style.animation-delay.ms]="i.delay"
                    [style.animation-timing-function]="'linear'"
                    [style.animation-iteration-count]="'infinite'"
                    [style.opacity]="0"
                  />
                }
              </g>
            }
            @case ('fireworks') {
              @for (burst of fireworksBursts(); track burst.id) {
                <g [style.animation-name]="'fireworkPop'"
                   [style.animation-duration.ms]="burst.duration"
                   [style.animation-delay.ms]="burst.delay"
                   [style.animation-fill-mode]="'forwards'"
                   [style.opacity]="0">
                  <circle
                    [attr.cx]="burst.cx + '%'"
                    [attr.cy]="burst.cy + '%'"
                    [attr.r]="burst.radius"
                    [attr.fill]="burst.colour"
                    [attr.opacity]="0.6"
                  />
                  @for (ray of burst.rays; track ray.angle) {
                    <line
                      [attr.x1]="burst.cx + '%'"
                      [attr.y1]="burst.cy + '%'"
                      [attr.x2]="(burst.cx + ray.dx) + '%'"
                      [attr.y2]="(burst.cy + ray.dy) + '%'"
                      [attr.stroke]="burst.colour"
                      [attr.stroke-width]="2"
                      [attr.opacity]="0.8"
                    />
                  }
                </g>
              }
            }
            @case ('fly') {
              <g class="fly-group">
                <text
                  [style.animation-name]="'rocketFly'"
                  [style.animation-duration.ms]="2500"
                  [style.animation-timing-function]="'cubic-bezier(0.4, 0, 0.2, 1)'"
                  [style.animation-iteration-count]="'infinite'"
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size="80"
                >{{ overlay.gift.icon }}</text>
              </g>
            }
            @case ('bounce') {
              <g class="bounce-group">
                <text
                  [style.animation-name]="'giftBounce'"
                  [style.animation-duration.ms]="800"
                  [style.animation-timing-function]="'cubic-bezier(0.68, -0.55, 0.265, 1.55)'"
                  [style.animation-iteration-count]="'3'"
                  [style.animation-fill-mode]="'forwards'"
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size="120"
                >{{ overlay.gift.icon }}</text>
              </g>
            }
            @case ('float') {
              <g class="float-group">
                <text
                  [style.animation-name]="'gentleFloat'"
                  [style.animation-duration.ms]="3500"
                  [style.animation-timing-function]="'ease-in-out'"
                  [style.animation-iteration-count]="'1'"
                  [style.animation-fill-mode]="'forwards'"
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size="100"
                  opacity="0"
                >{{ overlay.gift.icon }}</text>
              </g>
            }
            @default {
              <g class="fade-group">
                <text
                  [style.animation-name]="'giftFadeInOut'"
                  [style.animation-duration.ms]="3000"
                  [style.animation-timing-function]="'ease-in-out'"
                  [style.animation-iteration-count]="'1'"
                  [style.animation-fill-mode]="'forwards'"
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size="96"
                  opacity="0"
                >{{ overlay.gift.icon }}</text>
              </g>
            }
          }
        </svg>

        <!-- Gift info banner -->
        <div class="absolute bottom-16 inset-x-0 flex justify-center">
          <div
            class="bg-gradient-to-r from-amber-500/90 via-purple-600/90 to-amber-500/90 text-white px-8 py-4 rounded-3xl shadow-2xl border-2 border-amber-500/40 flex flex-col items-center gap-1 backdrop-blur-md animate-fadeInUp"
          >
            <span class="text-4xl">{{ overlay.gift.icon }}</span>
            <h3 class="text-lg font-black tracking-wide">
              {{ 'gift.broadcastTitle' | t: { giftName: overlay.gift.name } }}
            </h3>
            <p class="text-sm font-bold text-amber-100">
              {{
                'gift.broadcastDesc'
                  | t
                    : {
                        sender: overlay.sender_name,
                        receiver: overlay.receiver_name,
                        giftName: overlay.gift.name,
                        cost: overlay.gift.cost_coins,
                      }
              }}
            </p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      @keyframes confettiFall {
        0% {
          transform: translateY(-100%) rotate(0deg);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(720deg);
          opacity: 0;
        }
      }

      @keyframes fireworkPop {
        0% {
          opacity: 0;
          transform: scale(0);
        }
        40% {
          opacity: 1;
          transform: scale(1.2);
        }
        70% {
          opacity: 0.8;
          transform: scale(0.9);
        }
        100% {
          opacity: 0;
          transform: scale(1.5);
        }
      }

      @keyframes rocketFly {
        0% {
          transform: translate(-100vw, 30vh) rotate(-15deg);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        50% {
          transform: translate(50vw, -20vh) rotate(0deg);
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translate(110vw, -60vh) rotate(15deg);
          opacity: 0;
        }
      }

      @keyframes giftBounce {
        0% {
          transform: translateY(-200px) scale(0.3);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        40% {
          transform: translateY(40px) scale(1.15);
        }
        60% {
          transform: translateY(-80px) scale(0.95);
        }
        75% {
          transform: translateY(20px) scale(1.05);
        }
        85% {
          transform: translateY(-30px) scale(0.98);
        }
        100% {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
      }

      @keyframes gentleFloat {
        0% {
          transform: translateY(80px) scale(0.6);
          opacity: 0;
        }
        20% {
          opacity: 0.9;
        }
        60% {
          transform: translateY(-40px) scale(1.1);
          opacity: 1;
        }
        100% {
          transform: translateY(-10px) scale(1);
          opacity: 1;
        }
      }

      @keyframes giftFadeInOut {
        0% {
          opacity: 0;
          transform: scale(0.5);
        }
        25% {
          opacity: 1;
          transform: scale(1.2);
        }
        50% {
          transform: scale(1);
        }
        75% {
          opacity: 1;
          transform: scale(1.05);
        }
        100% {
          opacity: 0;
          transform: scale(0.8);
        }
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .animate-fadeInUp {
        animation: fadeInUp 0.4s ease-out forwards;
        animation-delay: 0.3s;
        opacity: 0;
      }
    `,
  ],
})
export class GiftAnimationOverlayComponent {
  readonly store = inject(EconomyStore);

  readonly confettiPieces = computed(() => {
    const colours = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8', '#20c997', '#f06595'];
    const pieces = [];
    for (let i = 0; i < 60; i++) {
      pieces.push({
        id: i,
        x: Math.random() * 100,
        y: -5 - Math.random() * 20,
        size: 6 + Math.random() * 10,
        colour: colours[i % colours.length],
        duration: 2000 + Math.random() * 3000,
        delay: Math.random() * 3000,
      });
    }
    return pieces;
  });

  readonly fireworksBursts = computed(() => {
    const colours = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8'];
    const bursts = [];
    for (let b = 0; b < 8; b++) {
      const cx = 10 + Math.random() * 80;
      const cy = 10 + Math.random() * 60;
      const colour = colours[b % colours.length];
      const rays = [];
      for (let r = 0; r < 12; r++) {
        const angle = (r / 12) * Math.PI * 2;
        const length = 6 + Math.random() * 12;
        rays.push({ angle, dx: Math.cos(angle) * length, dy: Math.sin(angle) * length });
      }
      bursts.push({
        id: b,
        cx,
        cy,
        radius: 3 + Math.random() * 8,
        colour,
        rays,
        duration: 1200 + Math.random() * 800,
        delay: Math.random() * 2500,
      });
    }
    return bursts;
  });
}
