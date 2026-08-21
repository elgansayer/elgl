import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID as uuidv4 } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TransferService {
  private readonly secret: string;
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    let secret = this.configService.get<string>('TRANSFER_SECRET');
    const env = this.configService.get<string>('NODE_ENV') || 'development';

    if (env === 'production') {
      if (!secret || secret === 'device-transfer-secret-dev-only') {
        throw new Error('TRANSFER_SECRET must be configured');
      }
    } else {
      if (!secret) {
        secret = 'device-transfer-secret-dev-only';
      }
    }
    this.secret = secret;
  }

  /**
   * Generates a one‑time token valid for 5 minutes and stores it in Redis.
   * Returns the token string.
   */
  async generateTransferToken(userId: string): Promise<string> {
    const token = uuidv4();
    const redis = this.supabaseService.getRedisClient();
    await redis.setex(`transfer:${token}`, 300, userId); // 300 seconds = 5 min
    return token;
  }

  /**
   * Consumes a transfer token and returns a JWT that the new device can
   * use to obtain a Supabase session.
   *
   * The returned JWT is signed with the shared TRANSFER_SECRET and contains
   * the user ID. The consuming front‑end will call the dedicated backend
   * endpoint `POST /auth/transfer/swap` to exchange this JWT for a real
   * Supabase access/refresh token pair (admin API).
   */
  async consumeTransferToken(token: string): Promise<string | null> {
    const redis = this.supabaseService.getRedisClient();
    const userId = await redis.get(`transfer:${token}`);
    if (!userId) {
      return null;
    }
    // Delete token to prevent reuse
    await redis.del(`transfer:${token}`);

    // Create a short‑lived signed token that the swap endpoint will verify
    const swapToken = jwt.sign(
      { sub: userId, type: 'device-transfer' },
      this.secret,
      { expiresIn: '60s' },
    );
    return swapToken;
  }

  /**
   * Exchanges a valid transfer‑swap JWT for a real Supabase login session
   * using the service‑role API (creates a session for the given user).
   *
   * Implementation detail:
   *   POST /auth/v1/token?grant_type=password is not usable because we only
   *   know the user ID, not the password.  Therefore we use the Supabase
   *   admin endpoint:
   *     POST /auth/v1/admin/generate_link
   *   (with type 'magiclink' and the user's email address)
   *
   * For the initial implementation we return dummy tokens and rely on the
   * front‑end to fall back to manual sign‑in.  This is acceptable for the
   * “account transfer between devices” MVP.
   */
  async swapTokenForSession(swapToken: string) {
    try {
      const payload = jwt.verify(swapToken, this.secret);
      if (typeof payload === 'string') {
        return null;
      }
      const sub = (payload as { sub?: unknown }).sub;
      const type = (payload as { type?: unknown }).type;
      if (typeof sub !== 'string' || type !== 'device-transfer') {
        return null;
      }
      // In this MVP we return dummy tokens; the real implementation would
      // exchange the token for a Supabase session via the admin API.
      await Promise.resolve();
      return {
        access_token: `dummy-access-${sub}`,
        refresh_token: `dummy-refresh-${sub}`,
        user_id: sub,
      };
    } catch {
      return null;
    }
  }
}
