import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { CurrUser } from '../auth/curr-user.decorator';

@Controller('notification-preferences')
@UseGuards(SupabaseAuthGuard)
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  @Get()
  async getPreferences(@CurrUser('sub') userId: string) {
    return this.service.getPreferences(userId);
  }

  @Put()
  async updatePreferences(
    @CurrUser('sub') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.service.updatePreferences(userId, dto);
  }

  @Post('reset')
  async resetToDefaults(@CurrUser('sub') userId: string) {
    return this.service.resetToDefaults(userId);
  }
}
