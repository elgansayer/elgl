import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
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

  @UseGuards(SupabaseAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: any,
    @Body('newPassword') newPassword: string,
  ) {
    if (!req.user || !req.user.id) {
      throw new Error('Unauthorized');
    }
    const userId: string = req.user.id;
    await this.authService.changePassword(userId, newPassword);
    return { message: 'Password changed successfully' };
  }
}
