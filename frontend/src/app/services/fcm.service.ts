import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  async registerToken(): Promise<string | null> {
    return null;
  }

  async unregisterToken(): Promise<void> {
    // Clean up FCM token on signout
  }

  async requestPermission(): Promise<void> {
    // Empty implementation
  }
}
