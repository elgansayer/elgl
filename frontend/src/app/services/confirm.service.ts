import { Injectable, signal } from '@angular/core';

export interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly confirmState = signal<ConfirmState | null>(null);

  confirm(message: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.confirmState.set({ message, resolve });
    });
  }

  dismiss(result: boolean): void {
    const state = this.confirmState();
    if (state) {
      state.resolve(result);
      this.confirmState.set(null);
    }
  }
}
