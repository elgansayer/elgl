import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { XpService } from './xp.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

interface XpRequestUser {
  sub?: string;
  id?: string;
}

@Controller('xp')
export class XpController {
  constructor(private readonly xpService: XpService) {}

  private userIdFromReq(req: { user?: XpRequestUser }): string {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  async getXp(
    @Req() req: { user?: XpRequestUser },
  ): Promise<{ total: number; level: number }> {
    const userId = this.userIdFromReq(req);
    const total = await this.xpService.getXpTotal(userId);
    const level = await this.xpService.getLevel(userId);
    return { total, level };
  }

  @Get('history')
  @UseGuards(SupabaseAuthGuard)
  async getXpHistory(
    @Req() req: { user?: XpRequestUser },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<
    Array<{
      id: string;
      user_id: string;
      points: number;
      activity: string;
      created_at: string;
    }>
  > {
    const userId = this.userIdFromReq(req);
    return this.xpService.getXpHistory(userId, limit ?? 50, offset ?? 0);
  }

  @Get('activities')
  @UseGuards(SupabaseAuthGuard)
  getActivityPoints(): Record<string, number> {
    return this.xpService.getActivityPoints();
  }
}
