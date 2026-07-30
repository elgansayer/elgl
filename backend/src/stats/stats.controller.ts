import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  async getMyStats(@Req() req: any) {
    const userId = req.user.sub;
    return this.statsService.getStats(userId);
  }
}
