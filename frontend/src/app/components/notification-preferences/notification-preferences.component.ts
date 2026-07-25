import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import {
  NotificationPreferencesService,
  NotificationPreferences,
  NotificationCategory,
  NotificationChannel,
} from '../../services/notification-preferences.service';
import { ToastService } from '../primitives/toast/toast.service';

interface CategoryInfo {
  key: NotificationCategory;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './notification-preferences.component.html',
  styleUrls: ['./notification-preferences.component.scss'],
})
export class NotificationPreferencesComponent implements OnInit {
  private readonly prefsService = inject(NotificationPreferencesService);
  private readonly toastService = inject(ToastService);

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

  ngOnInit(): void {
    this.loadPreferences();
  }

  private loadPreferences(): void {
    this.loading.set(true);
    this.prefsService.getPreferences().subscribe({
      next: (prefs) => {
        this.preferences.set(prefs);
        if (prefs.quiet_hours_start) this.quietHoursStart.set(prefs.quiet_hours_start);
        if (prefs.quiet_hours_end) this.quietHoursEnd.set(prefs.quiet_hours_end);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load notification preferences', err);
        this.toastService.show('Failed to load notification preferences', {
          type: 'error',
          duration: 3000,
        });
        this.loading.set(false);
      },
    });
  }

  toggleChannel(category: NotificationCategory, channel: NotificationChannel): void {
    const prefs = this.preferences();
    if (!prefs) return;

    const currentValue = prefs[category][channel];
    this.saving.set(true);

    this.prefsService.toggleCategoryChannel(category, channel, !currentValue, prefs).subscribe({
      next: (updated) => {
        this.preferences.set(updated);
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Failed to update preference', err);
        this.toastService.show('Failed to update notification preference', {
          type: 'error',
          duration: 3000,
        });
        this.saving.set(false);
      },
    });
  }

  toggleDoNotDisturb(): void {
    const prefs = this.preferences();
    if (!prefs) return;

    const newValue = !prefs.do_not_disturb;
    this.saving.set(true);

    this.prefsService
      .toggleDoNotDisturb(
        newValue,
        newValue ? this.quietHoursStart() : undefined,
        newValue ? this.quietHoursEnd() : undefined,
      )
      .subscribe({
        next: (updated) => {
          this.preferences.set(updated);
          this.saving.set(false);
          this.toastService.show(newValue ? 'Do Not Disturb enabled' : 'Do Not Disturb disabled', {
            type: 'success',
            duration: 2000,
          });
        },
        error: (err) => {
          console.error('Failed to update Do Not Disturb', err);
          this.toastService.show('Failed to update Do Not Disturb setting', {
            type: 'error',
            duration: 3000,
          });
          this.saving.set(false);
        },
      });
  }

  updateQuietHours(): void {
    const prefs = this.preferences();
    if (!prefs || !prefs.do_not_disturb) return;

    this.saving.set(true);
    this.prefsService
      .toggleDoNotDisturb(true, this.quietHoursStart(), this.quietHoursEnd())
      .subscribe({
        next: (updated) => {
          this.preferences.set(updated);
          this.saving.set(false);
          this.toastService.show('Quiet hours updated', {
            type: 'success',
            duration: 2000,
          });
        },
        error: (err) => {
          console.error('Failed to update quiet hours', err);
          this.toastService.show('Failed to update quiet hours', {
            type: 'error',
            duration: 3000,
          });
          this.saving.set(false);
        },
      });
  }

  resetToDefaults(): void {
    this.saving.set(true);
    this.prefsService.resetToDefaults().subscribe({
      next: (prefs) => {
        this.preferences.set(prefs);
        this.saving.set(false);
        this.toastService.show('Notification preferences reset to defaults', {
          type: 'success',
          duration: 2000,
        });
      },
      error: (err) => {
        console.error('Failed to reset preferences', err);
        this.toastService.show('Failed to reset preferences', {
          type: 'error',
          duration: 3000,
        });
        this.saving.set(false);
      },
    });
  }

  isChannelEnabled(category: NotificationCategory, channel: NotificationChannel): boolean {
    const prefs = this.preferences();
    if (!prefs) return false;
    return prefs[category][channel];
  }
}
