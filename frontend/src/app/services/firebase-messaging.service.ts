import { Injectable, inject, signal, effect } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseMessagingService {
  private messaging: Messaging | null = null;
  private messagingInitialized = false;

  readonly fcmToken = signal<string | null>(null);
  readonly permissionGranted = signal<boolean>(false);
  private readonly isBrowser = typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.serviceWorker !== 'undefined';

  constructor() {
    if (!this.isBrowser) {
      return;
    }
    this.initialiseFirebase();
  }

  private initialiseFirebase(): void {
    const app = initializeApp({
      apiKey: environment.firebase.apiKey,
      authDomain: environment.firebase.authDomain,
      projectId: environment.firebase.projectId,
      storageBucket: environment.firebase.storageBucket,
      messagingSenderId: environment.firebase.messagingSenderId,
      appId: environment.firebase.appId,
      vapidKey: environment.firebase.vapidKey,
    });
    this.messaging = getMessaging(app);
    this.messagingInitialized = true;

    this.requestPermissionAndGetToken();
    this.listenForForegroundMessages();
  }

  async requestPermissionAndGetToken(): Promise<void> {
    if (!this.messaging) {
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      this.permissionGranted.set(permission === 'granted');
      if (permission !== 'granted') {
        return;
      }

      // Register the firebase-messaging-sw.js service worker if not already registered.
      if (this.isBrowser && !navigator.serviceWorker.controller) {
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/',
          });
          await navigator.serviceWorker.ready;
        } catch (err) {
          console.error('Failed to register firebase-messaging-sw', err);
        }
      }

      const currentToken = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey,
        serviceWorkerRegistration: undefined,
      });

      if (currentToken) {
        this.fcmToken.set(currentToken);
      } else {
        console.warn('No registration token available.');
      }
    } catch (err) {
      console.error('An error occurred while retrieving token.', err);
    }
  }

  private listenForForegroundMessages(): void {
    if (!this.messaging) {
      return;
    }
    onMessage(this.messaging, (payload) => {
      console.log('Foreground message received:', payload);
      // You can dispatch an event or show a custom toast via your own notification service.
    });
  }

  /** Send the current FCM token to your backend for later push targeting. */
  async persistFcmToken(userId: string): Promise<void> {
    const token = this.fcmToken();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${environment.apiUrl}/users/fcm-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, fcm_token: token }),
      });
      if (!response.ok) {
        console.error('Failed to persist FCM token');
      }
    } catch (err) {
      console.error('Error persisting FCM token', err);
    }
  }
}
