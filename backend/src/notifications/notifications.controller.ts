import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: User | null,
    @Query('type') type?: string,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.notificationsService.getNotifications(user.id, type);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: User | null,
  ) {
    if (!user) throw new UnauthorizedException();
    await this.notificationsService.markAsRead(user.id, id);
    return { success: true };
  }
}
