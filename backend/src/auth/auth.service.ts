import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { EmailService } from '../email/email.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly twoFactorService: TwoFactorService,
    private readonly emailService: EmailService,
  ) {}

  async requestPasswordReset(email: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const linkResult = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: '' },
    });

    if (linkResult.error || !linkResult.data) {
      // Do not reveal whether the email exists
      return;
    }

    const data = linkResult.data as {
      properties?: { action_link?: string };
    } | null;

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      return;
    }

    const url = new URL(actionLink);
    const hash = url.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) {
      return;
    }

    // Send password reset email via EmailService instead of relying on
    // Supabase's default email template, so we can use our custom design
    await this.emailService.sendPasswordResetEmail(email, accessToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    try {
      const userResult = await supabase.auth.getUser(token);

      if (userResult.error || !userResult.data?.user?.id) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const userId = userResult.data.user.id;

      const updateResult = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (updateResult.error) {
        throw new BadRequestException(updateResult.error.message);
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const userResult = await supabase.auth.admin.getUserById(userId);
    if (userResult.error || !userResult.data?.user?.email) {
      throw new BadRequestException('User not found');
    }
    const email = userResult.data.user.email;
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: dto.currentPassword,
    });
    if (signInError) {
      throw new BadRequestException('Current password is incorrect');
    }
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        password: dto.newPassword,
      },
    );
    if (updateError) {
      throw new BadRequestException(updateError.message);
    }
  }

  async enableTwoFactor(
    userId: string,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    return this.twoFactorService.generateSecret(userId);
  }

  async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    try {
      const isValid = await this.twoFactorService.verifyToken(userId, token);
      if (!isValid) {
        throw new BadRequestException('Invalid 2FA token');
      }
      return true;
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to verify 2FA token',
      );
    }
  }

  async disableTwoFactor(userId: string, token: string): Promise<boolean> {
    try {
      await this.twoFactorService.disable(userId, token);
      return true;
    } catch {
      return false;
    }
  }

  async checkTwoFactorStatus(userId: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('two_factor_enabled')
      .eq('id', userId)
      .single();
    if (error || !data) return false;
    return data.two_factor_enabled === true;
  }
}
