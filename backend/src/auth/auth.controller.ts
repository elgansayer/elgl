import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-password-reset')
  async requestPasswordReset(@Body() dto: ForgotPasswordDto) {
    const token = await this.authService.requestPasswordReset(dto.email);
    return { token };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password successfully reset' };
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('change-password')
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const userId = this.getUserIdFromReq(req);
    await this.authService.changePassword(userId, dto);
    return { message: 'Password changed successfully' };
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('two-factor/enable')
  async enableTwoFactor(
    @Req() req: any,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    const userId = this.getUserIdFromReq(req);
    return this.authService.enableTwoFactor(userId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('two-factor/verify')
  async verifyTwoFactor(
    @Req() req: any,
    @Body('token') token: string,
  ): Promise<{ success: boolean }> {
    const userId = this.getUserIdFromReq(req);
    try {
      const valid = await this.authService.verifyTwoFactor(userId, token);
      return { success: valid };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to verify 2FA token',
      );
    }
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('two-factor/disable')
  async disableTwoFactor(
    @Req() req: any,
    @Body('token') token: string,
  ): Promise<{ success: boolean }> {
    const userId = this.getUserIdFromReq(req);
    const success = await this.authService.disableTwoFactor(userId, token);
    return { success };
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('two-factor/status')
  async twoFactorStatus(@Req() req: any): Promise<{ enabled: boolean }> {
    const userId = this.getUserIdFromReq(req);
    const enabled = await this.authService.checkTwoFactorStatus(userId);
    return { enabled };
  }

  private getUserIdFromReq(req: any): string {
    if (!req.user || !req.user.id) {
      throw new Error('Unauthorized');
    }
    return req.user.id;
  }
}
