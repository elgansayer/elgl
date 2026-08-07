import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatSettingsService, InitialMessageFilterSettings } from './chat-settings.service';
import { ChatSettingsDto } from './dto/chat-settings.dto';
import { InitialMessageFilterDto } from './dto/initial-message-filter.dto';

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

  @Get('initial-message-filter')
  async getInitialMessageFilter(
    @Request() req: any,
  ): Promise<InitialMessageFilterSettings> {
    const userId = req.user.sub;
    return this.settingsService.getInitialMessageFilter(userId);
  }

  @Put('initial-message-filter')
  async updateInitialMessageFilter(
    @Request() req: any,
    @Body() dto: InitialMessageFilterDto,
  ): Promise<InitialMessageFilterSettings> {
    const userId = req.user.sub;
    return this.settingsService.updateInitialMessageFilter(userId, dto);
  }
}
