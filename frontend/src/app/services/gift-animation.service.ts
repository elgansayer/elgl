import { Injectable, signal, inject, DestroyRef, computed } from '@angular/core';
import { firstValueFrom, interval, take } from 'rxjs';

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

/** Maximum living particles in the DOM to prevent GPU thrashing. */
const MAX_PARTICLES = 90;

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
  private animationFrameId: ReturnType<typeof requestAnimationFrame> | null = null;
  private startTime = 0;

  /** Prevent overlapping animations from piling up rAF callbacks. */
  private isPlaying = false;

  readonly currentAnimation = signal<GiftAnimationOverlay | null>(null);
  readonly isVisible = signal<boolean>(false);
  readonly particles = signal<SvgParticle[]>([]);
  readonly elapsed = signal<number>(0);
  readonly hasAnimation = computed(() => this.currentAnimation() !== null);

  private generateSecureId(): string {
    // Check for a complete lack of the crypto API, which should be very rare in modern browsers
    if (typeof crypto === 'undefined') {
      console.warn('Crypto API not available, using fallback PRNG');
      // Use a slightly less terrible fallback if crypto is completely unavailable, but avoid Math.random() as the primary fallback
      return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback using cryptographically secure random values
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  playAnimation(overlay: GiftAnimationOverlay): void {
    this.cleanup();

    this.currentAnimation.set({
      ...overlay,
      id: this.generateSecureId(),
    });
    this.isVisible.set(true);

    // Start SVG particle system
    this.particles.set(generateParticles(60));
    this.elapsed.set(0);
    this.startTime = performance.now();
    this.isPlaying = true;
    this.animationFrameId = requestAnimationFrame(this.tick);

    // Hide after 5 seconds, then clear the overlay after a short fade-out.
    void this.scheduleAutoHide();

    this.destroyRef.onDestroy(() => this.cleanup());
  }

  private async scheduleAutoHide(): Promise<void> {
    const hideTimeout = interval(5000).pipe(take(1));
    await firstValueFrom(hideTimeout);
    this.isVisible.set(false);
    const cleanupTimeout = interval(600).pipe(take(1));
    await firstValueFrom(cleanupTimeout);
    if (this.destroyRef.destroyed) return;
    this.currentAnimation.set(null);
    this.cancelParticles();
    this.isPlaying = false;
  }

  dismiss(): void {
    this.cleanup();
    this.isVisible.set(false);
    void this.scheduleCleanup();
  }

  private async scheduleCleanup(): Promise<void> {
    const cleanupTimeout = interval(600).pipe(take(1));
    await firstValueFrom(cleanupTimeout);
    if (this.destroyRef.destroyed) return;
    this.currentAnimation.set(null);
    this.cancelParticles();
    this.isPlaying = false;
  }

  private tick = (): void => {
    if (!this.isPlaying) {
      return;
    }

    const elapsedMs = performance.now() - this.startTime;
    this.elapsed.set(elapsedMs);

    if (elapsedMs >= 5000 || !this.currentAnimation()) {
      this.cancelParticles();
      this.isPlaying = false;
      return;
    }

    this.particles.update((pts) => {
      // Cull dead (fully transparent) particles.
      const alive = pts
        .filter((p) => p.opacity > 0)
        .map((p) => ({
          ...p,
          x: p.x + p.speedX * 0.04,
          y: p.y + p.speedY * 0.04,
          opacity: Math.max(0, p.opacity - 0.002),
          rotation: p.rotation + p.rotationSpeed * 0.016,
        }));

      // Top up to keep visual density without ballooning memory.
      if (elapsedMs < 3000 && alive.length < MAX_PARTICLES && Math.random() < 0.4) {
        const needed = Math.min(3, MAX_PARTICLES - alive.length);
        alive.push(...generateParticles(needed));
      }

      return alive;
    });

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
    this.cancelParticles();
    this.isPlaying = false;
  }
}
