import { HlmButton } from '@spartan-ng/helm/button';
import { Component, effect, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { StreakMilestoneService } from '../../services/streak-milestone.service';

interface ConfettiPiece {
  id: number;
  left: number;
  top: number;
  size: number;
  color: string;
  rotation: number;
  drift: number;
  delay: number;
  duration: number;
}

const CONFETTI_COLOURS = ['#ff0084', '#ff8c00', '#ffe600', '#00e5ff', '#9d00ff', '#00ff94'];

@Component({
  selector: 'app-streak-celebration-overlay',
  imports: [HlmButton, TranslatePipe],
  template: `
    @if (visible()) {
      <div class="fixed inset-0 z-[60] overflow-hidden pointer-events-none" aria-hidden="true">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

        <div class="absolute inset-0 flex items-center justify-center pointer-events-auto">
          <div class="text-center max-w-sm mx-auto px-4">
            <h2 class="text-4xl font-extrabold text-white mb-2">
              {{ 'streak.celebration.title' | t: { days: milestoneDays() } }}
            </h2>
            <p class="text-lg text-white/80 mb-6">
              {{ 'streak.celebration.subtitle' | t: { days: milestoneDays() } }}
            </p>
            <button
              hlmBtn
              class="px-8 py-3 rounded-full bg-gradient-to-r from-neon-violet to-neon-pink text-on-fill font-semibold"
              (click)="dismiss()"
            >
              {{ 'common.close' | t }}
            </button>
          </div>
        </div>

        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          @for (piece of pieces(); track piece.id) {
            <div
              class="confetti-piece"
              [style.insetInlineStart.px]="piece.left"
              [style.top.px]="piece.top"
              [style.width.px]="piece.size"
              [style.height.px]="piece.size * 0.7"
              [style.background-color]="piece.color"
              [style.animation-delay]="piece.delay + 'ms'"
              [style.animation-duration]="piece.duration + 'ms'"
              [style.transform]="'rotate(' + piece.rotation + 'deg)'"
              [style.--drift]="piece.drift + 'px'"
            ></div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .confetti-piece {
        position: absolute;
        top: -20px;
        border-radius: 2px;
        opacity: 0;
        animation-name: confetti-fall;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
      }

      @keyframes confetti-fall {
        0% {
          opacity: 1;
          transform: translate3d(0, 0, 0) rotate(0deg);
        }
        50% {
          opacity: 0.9;
        }
        100% {
          opacity: 0.5;
          transform: translate3d(var(--drift), 110vh, 0) rotate(720deg);
        }
      }
    `,
  ],
})
export class StreakCelebrationOverlayComponent {
  private readonly milestoneService = inject(StreakMilestoneService);
  readonly pieces = signal<ConfettiPiece[]>([]);

  readonly visible = this.milestoneService.visible;
  readonly milestoneDays = this.milestoneService.milestoneDays;

  private nextId = 0;

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.pieces.set(this.generatePieces(140));
      } else {
        this.pieces.set([]);
      }
    });
  }

  private generatePieces(count: number): ConfettiPiece[] {
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < count; i++) {
      const size = 8 + Math.random() * 8;
      pieces.push({
        id: this.nextId++,
        left: Math.random() * 100,
        top: -20 - Math.random() * 40,
        size,
        color: CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)],
        rotation: Math.random() * 360,
        drift: (Math.random() - 0.5) * 200,
        delay: Math.random() * 1500,
        duration: 2500 + Math.random() * 2500,
      });
    }
    return pieces;
  }

  dismiss(): void {
    this.milestoneService.clear();
  }
}
