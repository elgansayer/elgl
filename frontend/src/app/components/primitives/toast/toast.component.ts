import { Component, ChangeDetectionStrategy } from '@angular/core';
import { toastsSignal } from '../../../services/toast.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-toast',
  template: `
    <div
      class="fixed top-10 inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none p-4"
    >
      @for (toast of toastsSignal(); track toast.id) {
        <div
          class="px-4 py-2 rounded-card shadow-lift font-bold text-sm pointer-events-auto transition-all duration-base ease-app animate-slide-down border border-surface-100"
          [class.bg-surface-200]="toast.type === 'info'"
          [class.text-text-primary]="toast.type === 'info'"
          [class.bg-danger]="toast.type === 'error'"
          [class.text-on-fill]="toast.type === 'error' || toast.type === 'success'"
          [class.bg-success]="toast.type === 'success'"
          [attr.role]="toast.type === 'error' ? 'alert' : 'status'"
          [attr.aria-live]="toast.type === 'error' ? 'assertive' : 'polite'"
          aria-atomic="true"
        >
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      @keyframes slide-down {
        0% {
          opacity: 0;
          transform: translateY(-20px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-slide-down {
        animation: slide-down var(--app-motion-base) var(--app-ease-standard) forwards;
      }
      @media (prefers-reduced-motion: reduce) {
        .animate-slide-down {
          animation: none;
        }
      }
    `,
  ],
})
export class ToastComponent {
  toastsSignal = toastsSignal;
}
