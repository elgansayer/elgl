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
    let userId: string | null = null;
    try {
      const { data: authData } = await supabase.auth.admin.getUserByEmail(
        dto.email,
      );
      userId = authData.user?.id ?? null;
    } catch {
      // If getUserByEmail is not available, fall back to scanning auth users
      const { data: allUsers } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const match = allUsers?.users?.find(
        (u) => u.email?.toLowerCase() === dto.email.toLowerCase(),
      );
      userId = match?.id ?? null;
    }

    if (!userId) {
      // Do not reveal whether the email exists
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (insertError) {
      this.logger.error(`Failed to insert reset token: ${insertError.message}`);
      throw new BadRequestException('Failed to create reset token');
    }

    await this.emailService.sendPasswordResetEmail(dto.email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: tokenRecord, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('user_id, expires_at')
      .eq('token', dto.token)
      .eq('used', false)
      .single();

    if (tokenError || !tokenRecord) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);
    if (now > expiresAt) {
      throw new UnauthorizedException('Reset token has expired');
    }

    // Update password via Supabase admin API
    const { error: authError } = await supabase.auth.admin.updateUserById(
      tokenRecord.user_id,
      { password: dto.newPassword },
    );

    if (authError) {
      this.logger.error(
        `Failed to update password: ${authError.message}`,
        authError,
      );
      throw new BadRequestException('Failed to update password');
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', dto.token);
  }
}
