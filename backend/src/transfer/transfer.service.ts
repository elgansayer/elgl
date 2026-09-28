import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID as uuidv4 } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

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
      if (
        !secret ||
        secret === 'device-transfer-secret-dev-only' ||
        secret === 'test-transfer-secret'
      ) {
        throw new Error(
          'TRANSFER_SECRET must be configured securely in production',
        );
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
   * endpoint `POST /transfer/swap` to exchange this JWT for a real
   * Supabase access/refresh token pair (admin API).
   */
  async consumeTransferToken(token: string): Promise<string | null> {
    const redis = this.supabaseService.getRedisClient();
    const userId = await redis.getdel(`transfer:${token}`);
    if (!userId) {
      return null;
    }

    // Both stages are single-use, including concurrent requests on different hosts.
    const jti = uuidv4();
    await redis.setex(`transfer-swap:${jti}`, 60, userId);

    // Create a short-lived signed token that the swap endpoint will verify
    const swapToken = jwt.sign(
      { sub: userId, type: 'device-transfer', jti },
      this.secret,
      { expiresIn: '60s', algorithm: 'HS256' },
    );
    return swapToken;
  }

  /** Exchanges a single-use swap JWT for a session without signing in the shared client. */
  async swapTokenForSession(swapToken: string) {
    try {
      const payload = jwt.verify(swapToken, this.secret, {
        algorithms: ['HS256'],
      });
      if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        payload.type !== 'device-transfer' ||
        typeof payload.jti !== 'string' ||
        !payload.jti ||
        typeof payload.exp !== 'number'
      )
        return null;

      const redis = this.supabaseService.getRedisClient();
      if ((await redis.getdel(`transfer-swap:${payload.jti}`)) !== payload.sub)
        return null;

      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>(
        'SUPABASE_SERVICE_ROLE_KEY',
      );
      if (!supabaseUrl || !supabaseKey) return null;

      const admin = this.supabaseService.getClient().auth.admin;
      const { data: userData, error: userError } = await admin.getUserById(
        payload.sub,
      );
      if (
        userError ||
        userData?.user?.id !== payload.sub ||
        !userData.user.email
      )
        return null;

      const { data: linkData, error: linkError } = await admin.generateLink({
        type: 'magiclink',
        email: userData.user.email,
      });
      if (
        linkError ||
        linkData?.user?.id !== payload.sub ||
        !linkData.properties?.hashed_token ||
        linkData.properties.verification_type !== 'magiclink'
      )
        return null;

      // verifyOtp saves session state. A request-local client prevents another
      // user's session from replacing the shared service-role client's identity.
      const exchangeClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      const { data, error } = await exchangeClient.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      });
      const session = data?.session;
      if (
        error ||
        !session?.access_token ||
        !session.refresh_token ||
        session.user.id !== payload.sub
      )
        return null;

      return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user_id: payload.sub,
      };
    } catch {
      // Provider errors can include credentials, email addresses or login links.
      this.logger.warn('Device transfer session exchange failed');
      return null;
    }
  }
}
