import { Injectable, signal, inject, DestroyRef, computed } from '@angular/core';
import { interval } from 'rxjs';
import { take } from 'rxjs';

export type GiftAnimationType = 'float' | 'confetti' | 'premium' | 'sparkle' | 'hearts';

export interface GiftAnimationOverlay {
  id: string;
  giftName: string;
  giftIcon: string;
  animationType: GiftAnimationType;
  animationUrl?: string;
  senderName: string;
  receiverName: string;
  coinValue: number;
}

export interface SvgParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  colour: string;
  shape: 'circle' | 'star' | 'heart' | 'diamond';
}

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

function generateParticles(count: number): SvgParticle[] {
  const particles: SvgParticle[] = [];
  const shapes: SvgParticle['shape'][] = ['circle', 'star', 'heart', 'diamond'];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      x: 50 + (Math.random() - 0.5) * 30,
      y: 45 + Math.random() * 10,
      size: 4 + Math.random() * 10,
      speedX: (Math.random() - 0.5) * 8,
      speedY: -(3 + Math.random() * 10),
      opacity: 0.7 + Math.random() * 0.3,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 360,
      colour: PARTICLE_COLOURS[Math.floor(Math.random() * PARTICLE_COLOURS.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    });
  }
  return particles;
}

@Injectable({ providedIn: 'root' })
export class GiftAnimationService {
  private destroyRef = inject(DestroyRef);
  private autoHideSub: { unsubscribe: () => void } | null = null;
  private animationFrameId: ReturnType<typeof requestAnimationFrame> | null = null;
  private startTime = 0;
  private particleCount = 0;

  readonly currentAnimation = signal<GiftAnimationOverlay | null>(null);
  readonly isVisible = signal<boolean>(false);
  readonly particles = signal<SvgParticle[]>([]);
  readonly elapsed = signal<number>(0);
  readonly hasAnimation = computed(() => this.currentAnimation() !== null);

  playAnimation(overlay: GiftAnimationOverlay): void {
    this.cleanup();
    this.currentAnimation.set({
      ...overlay,
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    });
    this.isVisible.set(true);

    // Start SVG particle system
    this.particles.set(generateParticles(60));
    this.particleCount = 60;
    this.elapsed.set(0);
    this.startTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.tick);

    const hideSub = interval(5000)
      .pipe(take(1))
      .subscribe(() => {
        this.isVisible.set(false);
        const cleanupSub = interval(600)
          .pipe(take(1))
          .subscribe(() => {
            this.currentAnimation.set(null);
            this.cancelParticles();
          });
        this.autoHideSub = cleanupSub;
      });
    this.autoHideSub = hideSub;

    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  dismiss(): void {
    this.clearTimer();
    this.isVisible.set(false);
    const cleanupSub = interval(600)
      .pipe(take(1))
      .subscribe(() => {
        this.currentAnimation.set(null);
        this.cancelParticles();
      });
    this.autoHideSub = cleanupSub;
  }

  private tick = (): void => {
    const elapsed = performance.now() - this.startTime;
    this.elapsed.set(elapsed);

    if (elapsed >= 5000 || !this.currentAnimation()) {
      this.cancelParticles();
      return;
    }

    this.particles.update((pts) =>
      pts.map((p) => ({
        ...p,
        x: p.x + p.speedX * 0.04,
        y: p.y + p.speedY * 0.04,
        opacity: Math.max(0, p.opacity - 0.002),
        rotation: p.rotation + p.rotationSpeed * 0.016,
      })),
    );

    if (elapsed < 3000 && Math.random() < 0.4) {
      this.particles.update((pts) => [...pts, ...generateParticles(3)]);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private cancelParticles(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.particles.set([]);
    this.elapsed.set(0);
  }

  private cleanup(): void {
    this.clearTimer();
    this.cancelParticles();
  }

  private clearTimer(): void {
    if (this.autoHideSub !== null) {
      this.autoHideSub.unsubscribe();
      this.autoHideSub = null;
    }
  }
}
