import { Injectable, signal } from '@angular/core';

export interface GiftAnimation {
  id: string;
  giftId: string;
  animationUrl: string;
}

@Injectable({ providedIn: 'root' })
export class GiftAnimationService {
  readonly currentAnimation = signal<GiftAnimation | null>(null);

  playAnimation(giftId: string, animationUrl: string) {
    this.currentAnimation.set({ id: Math.random().toString(), giftId, animationUrl });
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      this.currentAnimation.set(null);
    }, 4000);
  }
}
