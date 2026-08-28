import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('quests')
@UseGuards(SupabaseAuthGuard)
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get()
  async getQuests(@Req() req: any) {
    return this.questsService.getDailyQuests(req.user.id);
  }
}
