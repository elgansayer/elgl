import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { NotificationDto } from './dto/notification.dto';
import {
  NotificationUnreadCounts,
  NotificationsInboxService,
} from './notifications-inbox.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(
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
  ): Promise<NotificationUnreadCounts> {
    if (!user) throw new UnauthorizedException();
    return this.notificationsInboxService.getUnreadCount(user.id);
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
