import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-audio-equalizer',
  imports: [],
  host: {
    '[class]': 'customClass()',
  },
  template: `
    <div
      class="flex items-end justify-center gap-0.5 h-5"
      [class.opacity-40]="!isActive()"
    >
      @for (bar of bars(); track $index) {
        <div
          class="w-1 rounded-t-sm bg-current"
          [class.animate-eq]="isActive()"
          [style.animation-delay]="bar.delay"
          [style.height]="isActive() ? undefined : '4px'"
        ></div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      @keyframes eq {
        0%, 100% {
          height: 20%;
        }
        50% {
          height: 100%;
        }
      }
      .animate-eq {
        animation: eq 0.6s ease-in-out infinite;
      }
    `,
  ],
})
export class AudioEqualizerComponent {
  /** Whether the speaker is currently talking */
  isActive = input<boolean>(false);

  /** Number of equalizer bars to display */
  barCount = input<number>(4);

  /** Optional CSS classes to apply to the host element */
  customClass = input<string>('');

  /** Generate bars with staggered animation delays */
  bars = computed(() => {
    const count = this.barCount();
    return Array.from({ length: count }).map((_, i) => ({
      delay: `-${(i * 0.18) % 1}s`,
    }));
  });
}
