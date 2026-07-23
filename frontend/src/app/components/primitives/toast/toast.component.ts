import { Component, OnInit, OnDestroy } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, ToastMessage } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div class="fixed top-10 inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none p-4">
      @if (currentToast) {
        <div 
          class="px-4 py-2 rounded-full shadow-lg font-bold text-sm pointer-events-auto transition-all duration-300 animate-slide-down border border-surface-100"
          [class.bg-surface-200]="currentToast.type === 'info'"
          [class.text-text-primary]="currentToast.type === 'info'"
          [class.bg-red-500]="currentToast.type === 'error'"
          [class.text-white]="currentToast.type === 'error' || currentToast.type === 'success'"
          [class.bg-green-500]="currentToast.type === 'success'"
        >
          {{ currentToast.message }}
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
export class ToastComponent implements OnInit, OnDestroy {
  currentToast: ToastMessage | null = null;
  private subscription: Subscription | null = null;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.subscription = this.toastService.toastState$.subscribe((toast) => {
      this.currentToast = toast;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
