import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Quest, QuestsService } from './quests.service';

@Controller('quests')
@UseGuards(SupabaseAuthGuard)
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get()
  async getQuests(@CurrentUser() user: User | null): Promise<Quest[]> {
    if (!user) throw new UnauthorizedException();
    return this.questsService.getQuests(user.id);
  }
}
