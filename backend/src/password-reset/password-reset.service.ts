import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Look up user by email via Supabase auth admin API - emails live in
    // auth.users, not in the public.users table (which has no email column).
    const { data: allUsers, error: listError } =
      await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      this.logger.error('Failed to query accounts for password reset');
      throw new BadRequestException('Failed to process password reset request');
    }

    const match = allUsers?.users?.find(
      (user: { email?: string; id?: string }) =>
        user.email?.toLowerCase() === dto.email.toLowerCase(),
    );
    const userId = match?.id ?? null;

    if (!userId) {
      // Do not reveal whether the email exists.
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (insertError) {
      this.logger.error('Failed to persist password reset token');
      throw new BadRequestException('Failed to create reset token');
    }

    try {
      await this.emailService.sendPasswordResetEmail(dto.email, token);
    } catch {
      // A token whose email was never delivered should not remain usable.
      const { error: invalidateError } = await supabase
        .from('password_reset_tokens')
        .update({ used: true })
        .eq('token', token);

      if (invalidateError) {
        this.logger.error('Failed to invalidate undelivered password reset token');
      }
      this.logger.error('Failed to dispatch password reset email');
      throw new BadRequestException('Failed to dispatch password reset email');
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Claim the token with a single conditional UPDATE. PostgreSQL rechecks the
    // predicates after row-lock waits, so concurrent requests cannot both claim
    // the same single-use token.
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', dto.token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .select('user_id')
      .maybeSingle();

    if (tokenError || !tokenRecord) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(
      tokenRecord.user_id,
      { password: dto.newPassword },
    );

    if (authError) {
      this.logger.error('Failed to update password after reset token claim');
      throw new BadRequestException('Failed to update password');
    }
  }
}
