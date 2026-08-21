import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, afterNextRender, inject, ElementRef } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-streak-congratulations',
  imports: [HlmButton, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70"
      (click)="onOverlayClick($event)"
      (keydown)="onOverlayKeydown($event)"
      tabindex="0"
      role="dialog"
    >
      <canvas #confettiCanvas class="absolute inset-0 pointer-events-none"></canvas>

      <div
        class="relative z-10 flex flex-col items-center gap-6 p-8 rounded-2xl bg-surface shadow-2xl border border-accent"
        (click)="$event.stopPropagation()"
        (keydown)="$event.stopPropagation()"
        tabindex="-1"
      >
        <span class="text-6xl">🎉</span>
        <h2 class="text-3xl font-bold text-white text-center">
          {{ 'streak_congratulations.title' | t: { days: streakDays() } }}
        </h2>
        <p class="text-white/70 text-center max-w-xs">
          {{ 'streak_congratulations.subtitle' | t: { days: streakDays() } }}
        </p>
        <button
          hlmBtn
          class="px-8 py-3 mt-4 rounded-full bg-accent text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          (click)="dismiss.emit()"
          (keydown)="dismiss.emit()"
        >
          {{ 'streak_congratulations.keep_going' | t }}
        </button>
      </div>
    </div>
  `,
  styles: [],
})
export class StreakCongratulationsComponent {
  readonly streakDays = input.required<number>();
  readonly dismiss = output<void>();

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    afterNextRender(() => this.startConfetti());
  }

  private startConfetti(): void {
    const canvas = this.host.nativeElement.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;
    canvas.width = w();
    canvas.height = h();

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      colour: string;
      life: number;
    }[] = [];

    const colours = ['#FFD700', '#FF6B6B', '#48C9B0', '#FF69B4', '#85C1E9'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * w(),
        y: -20 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 6,
        vy: 3 + Math.random() * 6,
        size: 6 + Math.random() * 8,
        colour: colours[Math.floor(Math.random() * colours.length)],
        life: 100 + Math.floor(Math.random() * 60),
      });
    }

    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, w(), h());

      for (const p of particles) {
        if (p.life <= 0) continue;
        p.life--;
        p.x += p.vx;
        p.vy += 0.1;
        p.y += p.vy;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((frame * 0.05) % (Math.PI * 2));
        ctx.fillStyle = p.colour;
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      const alive = particles.some((p) => p.life > 0);
      if (alive && frame < 400) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      this.dismiss.emit();
    }
  }

  onOverlayClick(_event: MouseEvent): void {
    this.dismiss.emit();
  }
}
