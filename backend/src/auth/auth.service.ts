import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async requestPasswordReset(email: string): Promise<string> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: '' },
    });

    if (error || !data?.properties?.action_link) {
      throw new BadRequestException(
        error?.message ?? 'Unable to generate reset link',
      );
    }

    const actionLink = data.properties.action_link;
    const url = new URL(actionLink);
    const hash = url.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) {
      throw new BadRequestException('Unable to extract reset token');
    }
    return accessToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);

      if (userError || !user || !user.id) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const userId = user.id;

      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (error) {
        throw new BadRequestException(error.message);
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
    const { data: userResult, error: userError } =
      await supabase.auth.admin.getUserById(userId);
    if (userError || !userResult?.user?.email) {
      throw new BadRequestException('User not found');
    }
    const email = userResult.user.email;
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
    return this.twoFactorService.isEnabled(userId);
  }
}
