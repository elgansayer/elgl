import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { TwoFactorService } from './two-factor.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

type AuthenticatedRequest = Omit<Request, 'user'> & { user?: { id: string } };

@Controller('two-factor')
@UseGuards(SupabaseAuthGuard)
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('enable')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async enable(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.twoFactorService.generateSecret(userId);
  }

  @Post('verify')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verify(
    @Req() req: AuthenticatedRequest,
    @Body() body: { token: string },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    const ok = await this.twoFactorService.verifyToken(userId, body.token);
    return { success: ok };
  }

  @Post('disable')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async disable(
    @Req() req: AuthenticatedRequest,
    @Body() body: { token: string },
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    await this.twoFactorService.disable(userId, body.token);
    return { success: true };
  }

  @Get('status')
  async status(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    const enabled = await this.twoFactorService.isEnabled(userId);
    return { enabled };
  }
}
