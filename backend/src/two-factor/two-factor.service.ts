import { Injectable, UnauthorizedException } from '@nestjs/common';
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

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    await this.supabaseService
      .getClient()
      .from('users')
      .update({ totp_secret: secret.base32 })
      .eq('id', userId);

    return { secret: secret.base32, qrCodeUrl };
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('totp_secret')
      .eq('id', userId)
      .single();

    if (error || !data?.totp_secret) {
      throw new UnauthorizedException(
        'Two‑factor authentication is not enabled',
      );
    }

    return speakeasy.totp.verify({
      secret: data.totp_secret,
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
      .update({ totp_secret: null })
      .eq('id', userId);
  }

  async isEnabled(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('totp_secret')
      .eq('id', userId)
      .single();

    if (error) return false;
    return !!data?.totp_secret;
  }
}
