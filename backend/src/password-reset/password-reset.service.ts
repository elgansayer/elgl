import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class PasswordResetService {
  private static readonly USER_LOOKUP_PAGE_SIZE = 1000;
  private static readonly MAX_USER_LOOKUP_PAGES = 100;
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const normalisedEmail = dto.email.toLowerCase();
    let userId: string | null = null;

    // Supabase Auth does not expose a get-by-email admin method. Paginate the
    // bounded admin listing rather than silently limiting password recovery to
    // the first 1,000 accounts.
    for (
      let page = 1;
      page <= PasswordResetService.MAX_USER_LOOKUP_PAGES;
      page += 1
    ) {
      const { data: pageData, error: listError } =
        await supabase.auth.admin.listUsers({
          page,
          perPage: PasswordResetService.USER_LOOKUP_PAGE_SIZE,
        });

      if (listError) {
        this.logger.error('Failed to query accounts for password reset');
        throw new BadRequestException(
          'Failed to process password reset request',
        );
      }

      const users = pageData?.users ?? [];
      const match = users.find(
        (user: { email?: string; id?: string }) =>
          user.email?.toLowerCase() === normalisedEmail,
      );
      if (match?.id) {
        userId = match.id;
        break;
      }
      if (users.length < PasswordResetService.USER_LOOKUP_PAGE_SIZE) {
        break;
      }
    }

    if (!userId) {
      // Do not reveal whether the email exists or whether a bounded lookup
      // reached its safety limit.
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Only the newest reset request should remain usable for an account.
    const { error: invalidationError } = await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('user_id', userId)
      .eq('used', false);

    if (invalidationError) {
      this.logger.error('Failed to invalidate previous password reset tokens');
      throw new BadRequestException('Failed to create reset token');
    }

    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: userId,
        token: tokenHash,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (insertError) {
      this.logger.error('Failed to persist password reset token');
      throw new BadRequestException('Failed to create reset token');
    }

    try {
      // Only the raw one-time token leaves the service. The database stores its
      // SHA-256 digest so a token-table leak does not expose reset credentials.
      await this.emailService.sendPasswordResetEmail(dto.email, token);
    } catch {
      const { error: invalidateError } = await supabase
        .from('password_reset_tokens')
        .update({ used: true })
        .eq('token', tokenHash);

      if (invalidateError) {
        this.logger.error(
          'Failed to invalidate undelivered password reset token',
        );
      }
      this.logger.error('Failed to dispatch password reset email');
      throw new BadRequestException('Failed to dispatch password reset email');
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const tokenHash = this.hashToken(dto.token);

    // Claim the digest with one conditional UPDATE. PostgreSQL rechecks the
    // predicates after row-lock waits, so concurrent requests cannot both claim
    // the same single-use token.
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', tokenHash)
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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
