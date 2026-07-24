import { Injectable, inject, signal, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ToastService } from '../components/primitives/toast/toast.service';
import { CentrifugoService } from './centrifugo.service';
import { environment } from '../../environments/environment';

export interface FcmPayload {
  type: 'new_message' | 'call_invite' | 'moment_like' | 'moment_comment' | 'correction' | 'gift' | 'friend_request';
  title: string;
  body: string;
  data?: Record<string, string>;
  channel?: string;
  room_id?: string;
  sender_id?: string;
  sender_name?: string;
  sender_avatar?: string;
  is_video_call?: boolean;
  moment_id?: string;
  gift_id?: string;
  gift_animation_url?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FcmService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly centrifugoService = inject(CentrifugoService);
  private readonly ngZone = inject(NgZone);

  private swRegistration: ServiceWorkerRegistration | null = null;

  readonly fcmToken = signal<string | null>(null);
  readonly permissionGranted = signal<boolean>(false);
  readonly isSupported = signal<boolean>(false);

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Check if service workers and notifications are supported
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      console.warn('[FCM] Service Workers or Notifications not supported.');
      return;
    }

    this.isSupported.set(true);
    this.permissionGranted.set(Notification.permission === 'granted');

    // Register service worker for background messages
    try {
      this.swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      console.log('[FCM] Service Worker registered:', this.swRegistration.scope);

      // Listen for messages from the service worker (foreground messages)
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.ngZone.run(() => {
          this.handleForegroundMessage(event.data as FcmPayload);
        });
      });

      // Register token when user is authenticated
      this.authService.currentUser.subscribe((user) => {
        if (user) {
          this.registerToken();
        }
      });
    } catch (error) {
      console.error('[FCM] Service Worker registration failed:', error);
    }
  }

  /**
   * Request notification permission and register FCM token with backend.
   */
  async requestPermission(): Promise<string | null> {
    if (!this.isSupported()) {
      this.toastService.show({
        message: 'Push notifications are not supported on this device/browser.',
        type: 'warning',
        duration: 5000,
      });
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      this.permissionGranted.set(false);
      this.toastService.show({
        message: 'Notification permission denied. You won\'t receive push notifications.',
        type: 'warning',
        duration: 5000,
      });
      return null;
    }

    this.permissionGranted.set(true);
    return this.registerToken();
  }

  /**
   * Register or refresh the FCM token with the backend.
   */
  async registerToken(): Promise<string | null> {
    if (!this.swRegistration) {
      console.warn('[FCM] Service Worker not registered yet.');
      return null;
    }

    try {
      // Use the Push API directly (no Firebase SDK dependency)
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(environment.firebase.vapidKey),
      });

      // Convert subscription to a format the backend expects
      const token = JSON.stringify(subscription);
      this.fcmToken.set(token);

      // Send token to backend
      await this.http
        .post('/api/notifications/register-device', {
          token,
          platform: 'web',
        })
        .toPromise();

      console.log('[FCM] Token registered with backend.');
      return token;
    } catch (error) {
      console.error('[FCM] Token registration error:', error);
      return null;
    }
  }

  /**
   * Unregister the FCM token (e.g., on logout).
   */
  async unregisterToken(): Promise<void> {
    if (!this.swRegistration || !this.fcmToken()) {
      return;
    }

    const currentToken = this.fcmToken();
    this.fcmToken.set(null);

    try {
      // Unsubscribe from push
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Notify backend to remove the token
      await this.http
        .post('/api/notifications/unregister-device', {
          token: currentToken,
        })
        .toPromise();

      console.log('[FCM] Token unregistered.');
    } catch (error) {
      console.error('[FCM] Token unregistration error:', error);
    }
  }

  /**
   * Handle incoming foreground messages.
   * Shows a toast notification and optionally triggers actions.
   */
  private handleForegroundMessage(payload: FcmPayload): void {
    console.log('[FCM] Foreground message received:', payload);

    // Show in-app toast notification
    this.toastService.show({
      message: payload.body,
      type: 'info',
      duration: 6000,
      action: {
        label: 'View',
        callback: () => this.handleNotificationAction(payload),
      },
    });

    // If there's a channel, subscribe to it via Centrifugo for real-time updates
    if (payload.channel) {
      this.centrifugoService.subscribe(payload.channel, (data) => {
        console.log('[FCM] Real-time update on channel:', payload.channel, data);
      });
    }
  }

  /**
   * Handle user tapping on a notification action.
   * Routes to the appropriate view based on payload type.
   */
  private handleNotificationAction(payload: FcmPayload): void {
    console.log('[FCM] Notification action triggered:', payload.type, payload);
    // Navigation logic would go here when Router is available
  }

  /**
   * Convert a base64url string to a Uint8Array for the applicationServerKey.
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}
