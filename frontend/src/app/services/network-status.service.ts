import { Injectable, signal } from '@angular/core';

/**
 * Tracks browser connectivity via the `online`/`offline` window events so that
 * global UI (e.g. the offline banner) can react to connectivity changes.
 */
@Injectable({
  providedIn: 'root',
})
export class NetworkStatusService {
  private readonly onlineSignal = signal<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  readonly isOnline = this.onlineSignal.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private readonly handleOnline = (): void => {
    this.onlineSignal.set(true);
  };

  private readonly handleOffline = (): void => {
    this.onlineSignal.set(false);
  };
}
