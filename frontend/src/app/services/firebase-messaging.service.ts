import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FirebaseMessagingService {
  readonly fcmToken = signal<string | null>(null);
  readonly permissionGranted = signal<boolean>(false);
  private readonly isBrowser = typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.serviceWorker !== 'undefined';

  constructor() {}

  async requestPermissionAndGetToken(): Promise<void> {
    // Stub – no real Firebase integration in this build.
  }

  /** Send the current FCM token to your backend for later push targeting. */
  async persistFcmToken(_userId: string): Promise<void> {
    // Stub – no real Firebase integration in this build.
  }
}
