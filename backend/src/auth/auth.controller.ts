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
import { TransferService } from '../transfer/transfer.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

interface RequestWithUser {
  user?: { id: string };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly transferService: TransferService,
  ) {}

  @Post('request-password-reset')
  async requestPasswordReset(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message: 'If the email address exists, a reset link has been sent.',
    };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password successfully reset' };
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
  ) {
    const userId = this.getUserIdFromReq(req);
    await this.authService.changePassword(userId, dto);
    return { message: 'Password changed successfully' };
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('two-factor/enable')
  async enableTwoFactor(
    @Req() req: RequestWithUser,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    const userId = this.getUserIdFromReq(req);
    return this.authService.enableTwoFactor(userId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('two-factor/verify')
  async verifyTwoFactor(
    @Req() req: RequestWithUser,
    @Body('token') token: string,
  ): Promise<{ success: boolean }> {
    const userId = this.getUserIdFromReq(req);
    try {
      const valid = await this.authService.verifyTwoFactor(userId, token);
      return { success: valid };
    } catch (error) {
      throw new BadRequestException(
        (error as Error).message || 'Failed to verify 2FA token',
      );
    }
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('two-factor/disable')
  async disableTwoFactor(
    @Req() req: RequestWithUser,
    @Body('token') _token: string,
  ): Promise<{ success: boolean }> {
    const userId = this.getUserIdFromReq(req);
    const success = await this.authService.disableTwoFactor(userId, _token);
    return { success };
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('two-factor/status')
  async twoFactorStatus(
    @Req() req: RequestWithUser,
  ): Promise<{ enabled: boolean }> {
    const userId = this.getUserIdFromReq(req);
    const enabled = await this.authService.checkTwoFactorStatus(userId);
    return { enabled };
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('transfer/generate')
  async generateTransferLink(
    @Req() req: RequestWithUser,
  ): Promise<{ url: string }> {
    const userId = this.getUserIdFromReq(req);
    const token = await this.transferService.generateTransferToken(userId);
    const baseUrl = process.env.APP_URL ?? 'http://localhost:4200';
    const url = `${baseUrl}/device-transfer?token=${encodeURIComponent(token)}`;
    return { url };
  }

  @Post('transfer/consume')
  async consumeTransferLink(
    @Body('token') token: string,
  ): Promise<{ swapToken: string }> {
    const swapToken = await this.transferService.consumeTransferToken(token);
    if (!swapToken) {
      throw new BadRequestException('Invalid or expired transfer token');
    }
    return { swapToken };
  }

  @Post('transfer/swap')
  async swapTransferLink(@Body('swapToken') swapToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    user_id: string;
  }> {
    const result = await this.transferService.swapTokenForSession(swapToken);
    if (!result) {
      throw new BadRequestException('Invalid or expired swap token');
    }
    return result;
  }

  private getUserIdFromReq(req: RequestWithUser): string {
    if (!req.user || !req.user.id) {
      throw new Error('Unauthorized');
    }
    return req.user.id;
  }
}
