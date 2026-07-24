import { Component } from '@angular/core';
import { toastsSignal, ToastMessage } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="fixed top-10 inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none p-4">
      @for (toast of toastsSignal(); track toast.id) {
        <div 
          class="px-4 py-2 rounded-full shadow-lg font-bold text-sm pointer-events-auto transition-all duration-300 animate-slide-down border border-surface-100"
          [class.bg-surface-200]="toast.type === 'info'"
          [class.text-text-primary]="toast.type === 'info'"
          [class.bg-red-500]="toast.type === 'error'"
          [class.text-white]="toast.type === 'error' || toast.type === 'success'"
          [class.bg-green-500]="toast.type === 'success'"
        >
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-down {
      0% { opacity: 0; transform: translateY(-20px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .animate-slide-down {
      animation: slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class ToastComponent {
  toastsSignal = toastsSignal;
}
