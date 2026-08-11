import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { SupabaseService } from '../supabase/supabase.service';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly twoFactorService: TwoFactorService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  async requestPasswordReset(email: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: '' },
    });
    const link = data?.properties?.action_link;
    const token = link?.match(/access_token=([^&]+)/)?.[1];
    if (!error && token && this.emailService) {
      await this.emailService.sendPasswordResetEmail(email, token);
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const result = await client.auth.getUser(token);
    const userId = result.data?.user?.id;
    if (result.error || !userId)
      throw new BadRequestException('Invalid or expired reset token');
    const { error } = await client.auth.admin.updateUserById(userId, {
      password,
    });
    if (error) throw new BadRequestException(error.message);
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
        (error as Error).message || 'Failed to verify 2FA token',
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
