import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('notification-preferences')
@UseGuards(SupabaseAuthGuard)
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  @Get()
  async getPreferences(@CurrentUser() user: User | null) {
    return this.service.getPreferences(user?.id ?? '');
  }

  @Put()
  async updatePreferences(
    @CurrentUser() user: User | null,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.service.updatePreferences(user?.id ?? '', dto);
  }

  @Post('reset')
  async resetToDefaults(@CurrentUser() user: User | null) {
    return this.service.resetToDefaults(user?.id ?? '');
  }
}
