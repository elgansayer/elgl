import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { StatsService, MyStatsResponse } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  async getMyStats(
    @Req() req: { user: { sub: string } },
  ): Promise<MyStatsResponse> {
    const userId = req.user.sub;
    return this.statsService.getStats(userId);
  }
}
