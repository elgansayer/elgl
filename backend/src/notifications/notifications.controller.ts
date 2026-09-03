import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UpdateNotificationPreferencesDto } from '../notification-preferences/dto/update-notification-preferences.dto';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { NotificationDto } from './dto/notification.dto';
import { NotificationsInboxService } from './notifications-inbox.service';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsInboxService: NotificationsInboxService,
  ) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: User | null,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<NotificationDto[]> {
    if (!user) throw new UnauthorizedException();
    return this.notificationsInboxService.getNotifications(user.id, query);
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: User | null,
  ): Promise<{ unreadCount: number }> {
    if (!user) throw new UnauthorizedException();
    return this.notificationsInboxService.getUnreadCount(user.id);
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
    await this.notificationsInboxService.markAllAsRead(user.id);
    return { success: true };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: User | null,
  ): Promise<{ success: boolean }> {
    if (!user) throw new UnauthorizedException();
    await this.notificationsInboxService.markAsRead(user.id, id);
    return { success: true };
  }
}
