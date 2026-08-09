import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TwoFactorService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async generateSecret(
    userId: string,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    const secret = speakeasy.generateSecret({
      name: `HelloTalk:${userId}`,
    });

    if (!secret.otpauth_url) {
      throw new InternalServerErrorException(
        'Failed to generate 2FA otpauth URL',
      );
    }
    const qrCodeUrl: string = await qrcode.toDataURL(secret.otpauth_url);

    await this.supabaseService
      .getClient()
      .from('users')
      .update({
        totp_secret: secret.base32,
        two_factor_secret: secret.base32,
        two_factor_enabled: true,
      })
      .eq('id', userId);

    return { secret: secret.base32, qrCodeUrl };
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('totp_secret, two_factor_secret')
      .eq('id', userId)
      .single();

    const row = data as {
      totp_secret: string | null;
      two_factor_secret: string | null;
    } | null;
    const secret = row?.totp_secret ?? row?.two_factor_secret;
    if (error || !secret) {
      throw new UnauthorizedException(
        'Two‑factor authentication is not enabled',
      );
    }

    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }

  async disable(userId: string, token: string): Promise<void> {
    const valid = await this.verifyToken(userId, token);
    if (!valid) {
      throw new UnauthorizedException('Invalid two‑factor token');
    }

    await this.supabaseService
      .getClient()
      .from('users')
      .update({
        totp_secret: null,
        two_factor_secret: null,
        two_factor_enabled: false,
      })
      .eq('id', userId);
  }

  async isEnabled(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return false;

    const secretRecord = data as {
      totp_secret?: string;
      two_factor_secret?: string;
    } | null;
    return !!(secretRecord?.totp_secret || secretRecord?.two_factor_secret);
  }
}
