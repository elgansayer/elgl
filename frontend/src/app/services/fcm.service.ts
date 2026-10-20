import { Injectable, inject } from '@angular/core';
import { FirebaseMessagingService } from './firebase-messaging.service';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  private firebaseMessaging = inject(FirebaseMessagingService);

  async registerToken(): Promise<string | null> {
    await this.firebaseMessaging.requestPermissionAndGetToken();
    return this.firebaseMessaging.fcmToken();
  }

  async unregisterToken(): Promise<void> {
    // Stub: implement token deletion on backend if needed
  }

  async requestPermission(): Promise<void> {
    await this.firebaseMessaging.requestPermissionAndGetToken();
  }

  async persistFcmToken(userId: string): Promise<void> {
    await this.firebaseMessaging.persistFcmToken(userId);
  }
}
