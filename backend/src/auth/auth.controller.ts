import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-password-reset')
  async requestPasswordReset(@Body('email') email: string) {
    const token = await this.authService.requestPasswordReset(email);
    return { token };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    await this.authService.resetPassword(body.token, body.newPassword);
    return { message: 'Password successfully reset' };
  }

  @Post('change-password')
  async changePassword(
    @Req() req: any,
    @Body('newPassword') newPassword: string,
  ) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.decode(token) as { sub: string };
    const userId: string = decoded.sub;
    await this.authService.changePassword(userId, newPassword);
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
    const valid = await this.authService.verifyTwoFactor(userId, token);
    return { success: valid };
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
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.decode(token) as { sub: string };
    return decoded.sub;
  }
}
