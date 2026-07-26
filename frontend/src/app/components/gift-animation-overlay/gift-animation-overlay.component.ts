import { Component, inject } from '@angular/core';
import { GiftAnimationService } from '../../services/gift-animation.service';

@Component({
  selector: 'app-gift-animation-overlay',
  standalone: true,
  template: `
    @if (animationService.currentAnimation(); as anim) {
      <div class="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
        <!-- In a real app, you would use ngx-lottie or similar to render the animationUrl -->
        <div class="animate-bounce text-center">
          <div class="text-9xl drop-shadow-2xl">🎁</div>
          <div class="text-3xl font-bold text-white drop-shadow-lg mt-4">
            {{ anim.giftId }}
          </div>
        </div>
      </div>
    }
  `
})
export class GiftAnimationOverlayComponent {
  animationService = inject(GiftAnimationService);
}
