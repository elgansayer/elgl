import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('two-factor')
@UseGuards(SupabaseAuthGuard)
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('enable')
  async enable(@Req() req: any) {
    const userId = req.user?.id;
    return this.twoFactorService.generateSecret(userId);
  }

  @Post('verify')
  async verify(@Req() req: any, @Body() body: { token: string }) {
    const userId = req.user?.id;
    const ok = await this.twoFactorService.verifyToken(userId, body.token);
    return { success: ok };
  }

  @Post('disable')
  async disable(@Req() req: any, @Body() body: { token: string }) {
    const userId = req.user?.id;
    await this.twoFactorService.disable(userId, body.token);
    return { success: true };
  }

  @Get('status')
  async status(@Req() req: any) {
    const userId = req.user?.id;
    const enabled = await this.twoFactorService.isEnabled(userId);
    return { enabled };
  }
}
