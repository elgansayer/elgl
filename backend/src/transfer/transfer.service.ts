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
   *   Then we parse the generated token from the link and use verifyOtp.
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

      const supabase = this.supabaseService.getClient();

      // Retrieve the user's email
      const { data: userData, error: userError } =
        await supabase.auth.admin.getUserById(sub);
      if (userError || !userData?.user?.email) {
        this.logger.error(
          `Unable to retrieve email for user ${sub} during device transfer swap`,
        );
        return null;
      }
      const email = userData.user.email;

      // Generate magic link to get a token
      const { data: linkData, error: linkError } =
        await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email,
        });
      if (linkError || !linkData?.properties?.action_link) {
        this.logger.error(
          `Unable to generate link for user ${sub} during device transfer swap`,
        );
        return null;
      }

      const actionLink = linkData.properties.action_link;
      const url = new URL(actionLink);

      // Depending on Supabase settings, PKCE flow might use token_hash, or implicit might use token.
      const tokenHash = url.searchParams.get('token_hash');
      const token = url.searchParams.get('token');

      let verifyResult;
      if (tokenHash) {
        verifyResult = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink',
        });
      } else if (token) {
        verifyResult = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'magiclink',
        });
      } else {
        this.logger.error(
          `Unable to extract token from action_link for user ${sub}`,
        );
        return null;
      }

      if (verifyResult.error || !verifyResult.data?.session) {
        this.logger.error(
          `Failed to verify OTP during device transfer swap for user ${sub}: ${verifyResult.error?.message}`,
        );
        return null;
      }

      const session = verifyResult.data.session;

      return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user_id: sub,
      };
    } catch (error) {
      this.logger.error(
        `Error exchanging token for session: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
