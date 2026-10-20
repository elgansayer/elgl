import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NotificationsService } from './notifications.service';
import { NotificationDto } from './dto/notification.dto';
import { UpdateNotificationPreferencesDto } from '../notification-preferences/dto/update-notification-preferences.dto';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: User | null,
    @Query('type') type?: string,
  ): Promise<NotificationDto[]> {
    if (!user) throw new UnauthorizedException();
    return this.notificationsService.getNotifications(user.id, type);
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: User | null,
  ): Promise<{ unreadCount: number }> {
    if (!user) throw new UnauthorizedException();
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    return this.notificationsService.getPreferences(user.id);
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser() user: User | null,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<{ success: boolean; preferences: unknown }> {
    if (!user) throw new UnauthorizedException();

    // The legacy settings surface updates one category/channel at a time.
    // NotificationsService persists the four legacy categories as a single JSON
    // object, so always merge with the authenticated user's current state before
    // writing. Otherwise toggling one switch would reset every untouched category
    // to its defaults.
    const current = await this.notificationsService.getPreferences(user.id);
    const merged = {
      direct_messages: {
        ...current.direct_messages,
        ...(body.direct_messages ?? {}),
      },
      groups: {
        ...current.groups,
        ...(body.groups ?? {}),
      },
      likes: {
        ...current.likes,
        ...(body.likes ?? {}),
      },
      voice_rooms: {
        ...current.voice_rooms,
        ...(body.voice_rooms ?? {}),
      },
      do_not_disturb: body.do_not_disturb ?? current.do_not_disturb,
    };

    await this.notificationsService.updatePreferences(user.id, merged);
    const updated = await this.notificationsService.getPreferences(user.id);
    return { success: true, preferences: updated };
  }

  @Patch('read-all')
  async markAllAsRead(
    @CurrentUser() user: User | null,
  ): Promise<{ success: boolean }> {
    if (!user) throw new UnauthorizedException();
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: User | null,
  ): Promise<{ success: boolean }> {
    if (!user) throw new UnauthorizedException();
    await this.notificationsService.markAsRead(user.id, id);
    return { success: true };
  }
}
