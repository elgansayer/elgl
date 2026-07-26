import { Component, input, computed } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-audio-equalizer',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="flex items-end justify-center gap-0.5 h-4" [class.opacity-30]="!isActive()">
      @for (bar of bars(); track $index) {
        <div
          class="w-1 bg-current rounded-t-sm transition-all duration-200"
          [ngClass]="isActive() ? 'animate-eq' : 'h-1'"
          [style.animation-delay]="bar.delay"
          [style.height]="isActive() ? '100%' : '4px'"
        ></div>
      }
    </div>
  `,
  styles: [`
    @keyframes eq {
      0%, 100% { height: 20%; }
      50% { height: 100%; }
    }
    .animate-eq {
      animation: eq 0.8s ease-in-out infinite;
    }
  `]
})
export class AudioEqualizerComponent {
  /** Whether the speaker is currently talking */
  isActive = input<boolean>(false);
  
  /** Number of equalizer bars to display */
  barCount = input<number>(4);

  /** Generate bars with staggered animation delays */
  bars = computed(() => {
    const count = this.barCount();
    return Array.from({ length: count }).map((_, i) => ({
      // Stagger the animation delay so the bars bounce out of sync
      delay: `-${(i * 0.25) % 1}s`
    }));
  });
}
