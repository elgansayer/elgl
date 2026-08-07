import { Injectable, signal, inject, DestroyRef } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class GiftAnimationService {
  private destroyRef = inject(DestroyRef);
  private autoHideSub: { unsubscribe: () => void } | null = null;

  readonly currentAnimation = signal<GiftAnimationOverlay | null>(null);
  readonly isVisible = signal<boolean>(false);

  playAnimation(overlay: GiftAnimationOverlay): void {
    this.clearTimer();
    this.currentAnimation.set({
      ...overlay,
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    });
    this.isVisible.set(true);

    const hideSub = interval(5000)
      .pipe(take(1))
      .subscribe(() => {
        this.isVisible.set(false);
        const cleanupSub = interval(600)
          .pipe(take(1))
          .subscribe(() => {
            this.currentAnimation.set(null);
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
      });
    this.autoHideSub = cleanupSub;
  }

  private clearTimer(): void {
    if (this.autoHideSub !== null) {
      this.autoHideSub.unsubscribe();
      this.autoHideSub = null;
    }
  }
}
