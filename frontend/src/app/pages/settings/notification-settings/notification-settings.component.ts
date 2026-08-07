import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../services/translate.pipe';
import { I18nService } from '../../../services/i18n.service';
import {
  NotificationPreferencesService,
  type NotificationPreferences,
  type NotificationCategory,
} from '../../../services/notification-preferences.service';

interface SettingRow {
  category: NotificationCategory;
  labelKey: string;
  icon: string;
}

@Component({
  standalone: true,
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.component.html',
  imports: [TranslatePipe, RouterLink],
})
export class NotificationSettingsComponent {
  private readonly prefsService = inject(NotificationPreferencesService);
  private readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  readonly saved = signal(false);
  readonly error = signal('');

  private prefs = signal<NotificationPreferences | null>(null);

  readonly rows: SettingRow[] = [
    { category: 'direct_messages', labelKey: 'notification_settings.row.direct_messages', icon: '💬' },
    { category: 'groups', labelKey: 'notification_settings.row.groups', icon: '👥' },
    { category: 'likes', labelKey: 'notification_settings.row.likes', icon: '❤️' },
    { category: 'voice_rooms', labelKey: 'notification_settings.row.voicerooms', icon: '🎙️' },
  ];

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const prefs = await this.prefsService.getPreferences();
      this.prefs.set(prefs);
    } catch {
      this.error.set(this.i18n.translate('common.error_generic'));
    } finally {
      this.loading.set(false);
    }
  }

  pushEnabled(cat: NotificationCategory): boolean {
    const p = this.prefs();
    if (!p) return false;
    return p[cat]?.push ?? false;
  }

  badgesEnabled(cat: NotificationCategory): boolean {
    const p = this.prefs();
    if (!p) return false;
    return p[cat]?.badge ?? false;
  }

  async togglePush(cat: NotificationCategory): Promise<void> {
    const p = this.prefs();
    if (!p) return;
    const newVal = !this.pushEnabled(cat);
    try {
      const updated = await this.prefsService.toggleCategoryChannel(cat, 'push', newVal, p);
      this.prefs.set(updated);
    } catch {
      this.error.set(this.i18n.translate('common.error_generic'));
    }
  }

  async toggleBadges(cat: NotificationCategory): Promise<void> {
    const p = this.prefs();
    if (!p) return;
    const newVal = !this.badgesEnabled(cat);
    try {
      const updated = await this.prefsService.toggleCategoryChannel(cat, 'badge', newVal, p);
      this.prefs.set(updated);
    } catch {
      this.error.set(this.i18n.translate('common.error_generic'));
    }
  }

  rowLabelKey(row: SettingRow): string {
    return row.labelKey;
  }
}
