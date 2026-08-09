import { signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'info' | 'error' | 'success';
}

export const toastsSignal = signal<ToastMessage[]>([]);
let nextId = 0;

export function showToast(
  message: string,
  type: 'info' | 'error' | 'success' = 'info',
  durationMs = 3000,
) {
  const id = nextId++;
  toastsSignal.update((current) => [...current, { id, message, type }]);
  setTimeout(() => removeToast(id), durationMs);
}

export function showErrorToast(message: string, durationMs = 5000) {
  showToast(message, 'error', durationMs);
}

export function notImplementedToast(featureName?: string) {
  showToast(featureName ? `${featureName} is not implemented yet` : 'Not implemented yet', 'info');
}

export function removeToast(id: number) {
  toastsSignal.update((current) => current.filter((t) => t.id !== id));
}
