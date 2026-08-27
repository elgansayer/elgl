import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatSettingsService } from './chat-settings.service';
import { ChatSettingsDto } from './dto/chat-settings.dto';

@Controller('chat/settings')
@UseGuards(SupabaseAuthGuard)
export class ChatSettingsController {
  constructor(private readonly settingsService: ChatSettingsService) {}

  @Get()
  async getSettings(@Request() req: any): Promise<ChatSettingsDto> {
    const userId = req.user.sub;
    return this.settingsService.getSettings(userId);
  }

  @Put()
  async updateSettings(
    @Request() req: any,
    @Body() settings: ChatSettingsDto,
  ): Promise<ChatSettingsDto> {
    const userId = req.user.sub;
    return this.settingsService.updateSettings(userId, settings);
  }
}
