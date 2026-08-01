import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TransferService {
  private readonly secret: string;

  constructor(private readonly supabaseService: SupabaseService) {
    this.secret =
      process.env.TRANSFER_SECRET ?? 'device-transfer-secret-dev-only';
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
      const decoded = jwt.verify(swapToken, this.secret);
      if (typeof decoded !== 'object' || decoded === null) {
        return null;
      }
      if (!('sub' in decoded) || !('type' in decoded)) {
        return null;
      }
      if (
        typeof decoded.sub !== 'string' ||
        decoded.type !== 'device-transfer'
      ) {
        return null;
      }
      const userId = decoded.sub;
      const client = this.supabaseService.getClient();
      const { data: userData, error: userError } =
        await client.auth.admin.getUserById(userId);
      if (userError || !userData?.user) {
        return null;
      }
      const email = userData.user.email;
      if (!email) {
        return null;
      }
      const { data: linkData, error: linkError } =
        await client.auth.admin.generateLink({
          type: 'magiclink',
          email,
        });
      if (linkError || !linkData?.properties?.hashed_token) {
        return null;
      }
      const { data: sessionData, error: sessionError } =
        await client.auth.verifyOtp({
          type: 'magiclink',
          token_hash: linkData.properties.hashed_token,
          email,
        });
      if (sessionError || !sessionData?.session || !sessionData.user) {
        return null;
      }
      return {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        user_id: sessionData.user.id,
      };
    } catch {
      return null;
    }
  }
}
