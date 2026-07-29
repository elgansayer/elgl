import { Component, inject, signal, resource } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NotificationPreferencesService,
  NotificationPreferences,
  NotificationCategory,
  NotificationChannel,
} from '../../services/notification-preferences.service';
import { showToast } from '../../services/toast.service';

interface CategoryInfo {
  key: NotificationCategory;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-notification-preferences',
  imports: [FormsModule],
  templateUrl: './notification-preferences.component.html',
  styleUrls: ['./notification-preferences.component.scss'],
})
export class NotificationPreferencesComponent {
  private readonly prefsService = inject(NotificationPreferencesService);

  readonly preferences = signal<NotificationPreferences | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly quietHoursStart = signal<string>('22:00');
  readonly quietHoursEnd = signal<string>('08:00');

  readonly categories: CategoryInfo[] = [
    {
      key: 'new_message',
      label: 'New Messages',
      description: 'When someone sends you a direct message',
      icon: '💬',
    },
    {
      key: 'call_invite',
      label: 'Call Invites',
      description: 'When someone invites you to a voice or video call',
      icon: '📞',
    },
    {
      key: 'moment_like',
      label: 'Moment Likes',
      description: 'When someone likes your moments',
      icon: '❤️',
    },
    {
      key: 'moment_comment',
      label: 'Moment Comments',
      description: 'When someone comments on your moments',
      icon: '💭',
    },
    {
      key: 'correction',
      label: 'Corrections',
      description: 'When someone corrects your language',
      icon: '✏️',
    },
    {
      key: 'gift',
      label: 'Virtual Gifts',
      description: 'When someone sends you a virtual gift',
      icon: '🎁',
    },
    {
      key: 'profile_view',
      label: 'Profile Views',
      description: 'When someone views your profile',
      icon: '👁️',
    },
    {
      key: 'study_reminder',
      label: 'Study Reminders',
      description: 'Daily reminders to practice your languages',
      icon: '📚',
    },
    {
      key: 'friend_request',
      label: 'Friend Requests',
      description: 'When someone sends you a friend request',
      icon: '🤝',
    },
    {
      key: 'audio_room_invite',
      label: 'Audio Room Invites',
      description: 'When you are invited to join an audio room',
      icon: '🎙️',
    },
  ];

  readonly channels: { key: NotificationChannel; label: string }[] = [
    { key: 'push', label: 'Push' },
    { key: 'email', label: 'Email' },
    { key: 'in_app', label: 'In-App' },
  ];

  private prefsLoader = resource({
    loader: async () => {
      this.loading.set(true);
      try {
        const prefs = await this.prefsService.getPreferences();
        this.preferences.set(prefs);
        if (prefs.quiet_hours_start) this.quietHoursStart.set(prefs.quiet_hours_start);
        if (prefs.quiet_hours_end) this.quietHoursEnd.set(prefs.quiet_hours_end);
        return prefs;
      } catch (err) {
        console.error('Failed to load notification preferences', err);
        showToast('Failed to load notification preferences', 'error', 3000);
        return null;
      } finally {
        this.loading.set(false);
      }
    },
  });

  async toggleChannel(category: NotificationCategory, channel: NotificationChannel): Promise<void> {
    const prefs = this.preferences();
    if (!prefs) return;

    const currentValue = prefs[category][channel];
    this.saving.set(true);

    try {
      const updated = await this.prefsService.toggleCategoryChannel(
        category,
        channel,
        !currentValue,
        prefs,
      );
      this.preferences.set(updated);
    } catch (err) {
      console.error('Failed to update preference', err);
      showToast('Failed to update notification preference', 'error', 3000);
    } finally {
      this.saving.set(false);
    }
  }

  async toggleDoNotDisturb(): Promise<void> {
    const prefs = this.preferences();
    if (!prefs) return;

    const newValue = !prefs.do_not_disturb;
    this.saving.set(true);

    try {
      const updated = await this.prefsService.toggleDoNotDisturb(
        newValue,
        newValue ? this.quietHoursStart() : undefined,
        newValue ? this.quietHoursEnd() : undefined,
      );
      this.preferences.set(updated);
      showToast(newValue ? 'Do Not Disturb enabled' : 'Do Not Disturb disabled', 'success', 2000);
    } catch (err) {
      console.error('Failed to update Do Not Disturb', err);
      showToast('Failed to update Do Not Disturb setting', 'error', 3000);
    } finally {
      this.saving.set(false);
    }
  }

  async updateQuietHours(): Promise<void> {
    const prefs = this.preferences();
    if (!prefs || !prefs.do_not_disturb) return;

    this.saving.set(true);
    try {
      const updated = await this.prefsService.toggleDoNotDisturb(
        true,
        this.quietHoursStart(),
        this.quietHoursEnd(),
      );
      this.preferences.set(updated);
      showToast('Quiet hours updated', 'success', 2000);
    } catch (err) {
      console.error('Failed to update quiet hours', err);
      showToast('Failed to update quiet hours', 'error', 3000);
    } finally {
      this.saving.set(false);
    }
  }

  async resetToDefaults(): Promise<void> {
    this.saving.set(true);
    try {
      const prefs = await this.prefsService.resetToDefaults();
      this.preferences.set(prefs);
      showToast('Notification preferences reset to defaults', 'success', 2000);
    } catch (err) {
      console.error('Failed to reset preferences', err);
      showToast('Failed to reset preferences', 'error', 3000);
    } finally {
      this.saving.set(false);
    }
  }

  isChannelEnabled(category: NotificationCategory, channel: NotificationChannel): boolean {
    const prefs = this.preferences();
    if (!prefs) return false;
    return prefs[category][channel];
  }
}
