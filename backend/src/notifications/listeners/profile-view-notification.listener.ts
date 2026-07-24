import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProfileViewEvent } from '../events/notification.events';

@Injectable()
export class ProfileViewNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @OnEvent('profile.view')
  async handleProfileView(event: ProfileViewEvent): Promise<void> {
    if (event.viewerId === event.viewedUserId) return;

    try {
      const supabase = this.supabaseService.getClient();
      const { data: viewer } = await supabase
        .from('users')
        .select('display_name, avatar_url')
        .eq('id', event.viewerId)
        .single();

      if (!viewer) return;

      await this.notificationsService.createNotification(
        event.viewedUserId,
        event.viewerId,
        'profile_visit',
      );
    } catch (err) {
      console.error('Profile view notification listener error:', err);
    }
  }
}
