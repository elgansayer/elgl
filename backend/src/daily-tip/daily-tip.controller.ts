import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DailyTipService } from './daily-tip.service';

@Controller('daily-tip')
export class DailyTipController {
  constructor(private readonly dailyTipService: DailyTipService) {}

  @UseGuards(SupabaseAuthGuard)
  @Get()
  async getTodayTip(@Request() req): Promise<{ tip: string }> {
    const tip = await this.dailyTipService.getTodayTipForUser(req.user.id);
    return { tip };
  }
}
