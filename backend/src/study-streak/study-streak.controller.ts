import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { StudyStreakService } from './study-streak.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('study-streak')
@UseGuards(SupabaseAuthGuard)
export class StudyStreakController {
  constructor(private readonly streakService: StudyStreakService) {}

  @Get('me')
  async getMyStreak(
    @Request() req: { user?: { sub?: string; id?: string } },
  ): Promise<{ streak: number }> {
    const userId: string = req.user?.sub ?? req.user?.id ?? '';
    const streak = await this.streakService.getStreak(userId);
    return { streak };
  }

  @Post('checkin')
  async checkin(
    @Request() req: { user?: { sub?: string; id?: string } },
  ): Promise<{ streak: number }> {
    const userId: string = req.user?.sub ?? req.user?.id ?? '';
    const streak = await this.streakService.updateStreak(userId);
    return { streak };
  }

  @Get('health')
  health(): { ok: boolean } {
    return { ok: true };
  }
}
