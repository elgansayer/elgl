import {
  Controller,
  Get,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DailyTipService } from './daily-tip.service';

@Controller('daily-tip')
@UseGuards(SupabaseAuthGuard)
export class DailyTipController {
  constructor(private readonly dailyTipService: DailyTipService) {}

  @Get()
  async getTodayTip(
    @CurrentUser() user: User | null,
  ): Promise<{ tip: string }> {
    if (!user) throw new UnauthorizedException();
    const tip = await this.dailyTipService.getTodayTipForUser(user.id);
    return { tip };
  }
}
