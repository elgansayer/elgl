import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FirebaseAdmin = any;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async sendPushNotification(
    userId: string,
    payload: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data: tokens, error } = await supabase
        .from('user_push_tokens')
        .select('fcm_token')
        .eq('user_id', userId);

      if (error || !tokens || tokens.length === 0) {
        console.warn(`No push tokens found for user ${userId}`);
        return;
      }

      const fcmTokens = tokens.map((t: { fcm_token: string }) => t.fcm_token);
      await this.sendFcmBatch(fcmTokens, payload);
    } catch (err) {
      console.error(`Failed to send push notification to user ${userId}:`, err);
    }
  }

  private async sendFcmBatch(
    tokens: string[],
    payload: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<void> {
    let firebaseAdmin: FirebaseAdmin;
    try {
      firebaseAdmin = await import('firebase-admin');
    } catch {
      console.warn('firebase-admin not installed, skipping push notification');
      return;
    }

    if (!firebaseAdmin.apps.length) {
      const serviceAccountStr = this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT',
      );
      if (serviceAccountStr) {
        try {
          const serviceAccount = JSON.parse(serviceAccountStr);
          firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount),
          });
        } catch {
          console.warn(
            'Invalid FIREBASE_SERVICE_ACCOUNT config, skipping push',
          );
          return;
        }
      } else {
        console.warn('Firebase not configured, skipping push notification');
        return;
      }
    }

    const message = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        type: payload.type,
        ...(payload.data || {}),
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'hellotalk_default',
          priority: 'high' as const,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    try {
      const response = await firebaseAdmin
        .messaging()
        .sendEachForMulticast(message);
      console.log(
        `FCM sent: ${response.successCount} success, ${response.failureCount} failures`,
      );

      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp: FirebaseAdmin, idx: number) => {
          if (
            resp.error &&
            (resp.error.code === 'messaging/invalid-registration-token' ||
              resp.error.code === 'messaging/registration-token-not-registered')
          ) {
            invalidTokens.push(tokens[idx]);
          }
        });

        if (invalidTokens.length > 0) {
          const supabase = this.supabaseService.getClient();
          await supabase
            .from('user_push_tokens')
            .delete()
            .in('fcm_token', invalidTokens);
        }
      }
    } catch (err) {
      console.error('FCM batch send failed:', err);
    }
  }
}
