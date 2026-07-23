import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number; // milliseconds, default 3000
  action?: {
    label: string;
    callback: () => void;
  };
}

export interface ToastEvent {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastSubject = new Subject<ToastEvent>();
  private clearSubject = new Subject<void>();

  /** Observable that emits when a new toast should be shown. */
  toast$: Observable<ToastEvent> = this.toastSubject.asObservable();

  /** Observable that emits when all toasts should be cleared. */
  clear$: Observable<void> = this.clearSubject.asObservable();

  /**
   * Show a toast notification.
   *
   * @param message  The text to display.
   * @param options  Optional configuration (type, duration, action).
   */
  show(message: string, options?: Partial<ToastOptions>): void {
    const event: ToastEvent = {
      message,
      type: options?.type ?? 'info',
      duration: options?.duration ?? 3000,
      action: options?.action,
    };
    this.toastSubject.next(event);
  }

  /** Dismiss all currently visible toasts. */
  clear(): void {
    this.clearSubject.next();
  }
}
