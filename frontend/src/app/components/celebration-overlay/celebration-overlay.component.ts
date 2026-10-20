import {
  Component,
  inject,
  input,
  output,
  viewChild,
  afterNextRender,
  effect,
  OnDestroy,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle';
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

@Component({
  selector: 'app-celebration-overlay',
  imports: [CommonModule, TranslatePipe, AppButtonPrimaryComponent],
  templateUrl: './celebration-overlay.component.html',
  styleUrl: './celebration-overlay.component.scss',
})
export class CelebrationOverlayComponent implements OnDestroy {
  readonly milestone = input.required<number>();
  readonly visible = input<boolean>(false);
  readonly dismissed = output<void>();

  private readonly canvasRef = viewChild<HTMLCanvasElement>('confettiCanvas');
  private readonly destroyRef = inject(DestroyRef);

  private readonly particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private animationStarted = false;
  private finishTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (this.visible() && !this.animationStarted) {
        this.animationStarted = true;
        afterNextRender(() => {
          this.startAnimation();
        });
        // Auto‑dismiss after 6 seconds
        this.finishTimeoutId = setTimeout(() => this.dismiss(), 6000);
      }
    });
  }

  ngOnDestroy(): void {
    this.cancelPendingWork();
  }

  private startAnimation(): void {
    const canvas = this.canvasRef();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    // will be cleaned when component destroyed (listener removed)
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', resize));

    const colors = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

    for (let i = 0; i < 120; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 1) * 6 - 2,
        size: Math.random() * 8 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        opacity: 1,
      });
    }

    const durationMs = 6000;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const alpha = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;

      ctx!.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.vx *= 0.99; // air resistance
        p.rotation += p.rotationSpeed;

        // bounce off bottom
        if (p.y > canvas.height) {
          p.vy = -p.vy * 0.7;
          p.y = canvas.height - 2;
        }
        // bounce off left/right
        if (p.x < 0 || p.x > canvas.width) {
          p.vx *= -0.7;
        }

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.globalAlpha = p.opacity * alpha;

        if (p.shape === 'rect') {
          ctx!.fillStyle = p.color;
          ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx!.fillStyle = p.color;
          ctx!.fill();
        }
        ctx!.restore();
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.dismiss();
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  dismiss(): void {
    this.cancelPendingWork();
    this.animationStarted = false;
    this.dismissed.emit();
  }

  private cancelPendingWork(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.finishTimeoutId !== null) {
      clearTimeout(this.finishTimeoutId);
      this.finishTimeoutId = null;
    }
  }
}
