import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import { NotificationPreferences } from './interfaces/notification-preferences.interface';

@Controller('notification-preferences')
@UseGuards(SupabaseAuthGuard)
export class NotificationPreferencesController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  async getPreferences(
    @CurrentUser() user: { id: string },
  ): Promise<NotificationPreferences> {
    return this.preferencesService.getPreferences(user.id);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() dto: NotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.preferencesService.updatePreferences(user.id, dto);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetPreferences(
    @CurrentUser() user: { id: string },
  ): Promise<NotificationPreferences> {
    return this.preferencesService.resetToDefaults(user.id);
  }

  @Patch(':category/:channel')
  @HttpCode(HttpStatus.OK)
  async toggleCategoryChannel(
    @CurrentUser() user: { id: string },
    @Param('category') category: string,
    @Param('channel') channel: string,
    @Body('enabled') enabled: boolean,
  ): Promise<NotificationPreferences> {
    const allowedCategories = [
      'new_message',
      'call_invite',
      'moment_like',
      'moment_comment',
      'correction',
      'gift',
      'profile_view',
      'study_reminder',
      'friend_request',
      'audio_room_invite',
      'new_follower',
    ];
    const allowedChannels = ['push', 'email', 'in_app', 'badges'];
    if (!allowedCategories.includes(category)) {
      throw new BadRequestException(`Invalid category: ${category}`);
    }
    if (!allowedChannels.includes(channel)) {
      throw new BadRequestException(`Invalid channel: ${channel}`);
    }
    const dto: Record<string, Record<string, boolean | undefined>> = {
      [category]: {
        push: undefined,
        email: undefined,
        in_app: undefined,
        [channel]: enabled,
      },
    };
    return this.preferencesService.updatePreferences(user.id, dto);
  }
}
