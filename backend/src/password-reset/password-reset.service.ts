import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Look up user by email via Supabase Auth admin API
    const { data: authUsers, error: userError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      filter: `email eq "${dto.email}"`,
    });

    if (userError || !authUsers || authUsers.users.length === 0) {
      // Do not reveal whether the email exists
      return;
    }

    const authUser = authUsers.users[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: authUser.id,
        token,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (insertError) {
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

    // Update password via Supabase admin updateUserById
    const { error: authError } = await supabase.auth.admin.updateUserById(
      tokenRecord.user_id,
      { password: dto.newPassword },
    );

    if (authError) {
      throw new BadRequestException('Failed to update password');
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', dto.token);
  }
}
