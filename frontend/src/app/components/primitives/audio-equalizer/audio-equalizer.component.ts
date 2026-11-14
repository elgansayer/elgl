import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
} from '@angular/core';
import { I18nService } from '../../../services/i18n.service';

@Component({
  selector: 'app-audio-equalizer',
  // PERFORMANCE: Enabled OnPush change detection to prevent unnecessary re-renders in this pure UI primitive.
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  host: {
    '[class]': 'customClass()',
    '[attr.role]': '"img"',
    '[attr.aria-label]': 'accessibleLabel()',
  },
  template: `
    <div
      class="flex items-end justify-center gap-0.5 h-5"
      [class.opacity-40]="!isActive()"
      aria-hidden="true"
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
    <span class="sr-only">{{ accessibleLabel() }}</span>
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
      @media (prefers-reduced-motion: reduce) {
        .animate-eq {
          animation: none;
          height: 70%;
        }
      }
    `,
  ],
})
export class AudioEqualizerComponent {
  private readonly i18n = inject(I18nService);

  /** Whether the speaker is currently talking */
  isActive = input<boolean>(false);

  /** Number of equalizer bars to display */
  barCount = input<number>(4);

  /** Optional CSS classes to apply to the host element */
  customClass = input<string>('');

  /** Optional accessible label override for assistive technologies */
  ariaLabel = input<string>('');

  /** Accessible label describing whether the speaker is active */
  accessibleLabel = computed(() => {
    const custom = this.ariaLabel().trim();
    if (custom) return custom;
    return this.i18n.translate(
      this.isActive() ? 'common.audioActiveAria' : 'common.audioInactiveAria',
    );
  });

  /** Generate bars with staggered animation delays */
  bars = computed(() => {
    const count = this.barCount();
    return Array.from({ length: count }).map((_, i) => ({
      delay: `-${(i * 0.18) % 1}s`,
    }));
  });
}
