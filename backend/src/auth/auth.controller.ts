import { Controller, Post, Body, Req } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';

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
}
