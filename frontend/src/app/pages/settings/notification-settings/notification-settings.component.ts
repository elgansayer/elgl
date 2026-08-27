import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, resource } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';
import { I18nService } from '../../../services/i18n.service';
import {
  NotificationPreferencesService,
  LegacyCategory,
  LegacyChannel,
  LegacyNotificationPreferences,
} from '../../../services/notification-preferences.service';

interface CategoryToggle {
  key: LegacyCategory;
  labelKey: string;
  icon: string;
}

@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [HlmButton, TranslatePipe],
  templateUrl: './notification-settings.component.html',
})
export class NotificationSettingsComponent {
  private readonly prefsService = inject(NotificationPreferencesService);
  private readonly i18n = inject(I18nService);

  readonly categories: CategoryToggle[] = [
    {
      key: 'direct_messages',
      labelKey: 'notification_settings.category.direct_messages',
      icon: '💬',
    },
    { key: 'groups', labelKey: 'notification_settings.category.groups', icon: '👥' },
    { key: 'likes', labelKey: 'notification_settings.category.likes', icon: '❤️' },
    { key: 'voice_rooms', labelKey: 'notification_settings.category.voice_rooms', icon: '🎤' },
  ];

  readonly channels: LegacyChannel[] = ['push', 'badge'];

  readonly prefs = signal<LegacyNotificationPreferences | null>(null);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);

  private readonly prefsResource = resource({
    loader: async () => {
      this.loadError.set(null);
      try {
        const prefs = await this.prefsService.getLegacyPreferences();
        this.prefs.set(prefs);
        return prefs;
      } catch {
        this.loadError.set(this.i18n.translate('common.error_generic'));
        return null;
      }
    },
  });

  constructor() {
    this.prefsResource.reload();
  }

  toggleValue(cat: LegacyCategory, ch: LegacyChannel): boolean {
    const p = this.prefs();
    if (!p) return false;
    return p[cat][ch];
  }

  channelLabel(ch: LegacyChannel): string {
    return `notification_settings.channel.${ch}`;
  }

  async toggle(cat: LegacyCategory, ch: LegacyChannel): Promise<void> {
    const p = this.prefs();
    if (!p) return;
    const current = p[cat][ch];
    const update = {
      [cat]: {
        push: ch === 'push' ? !current : p[cat].push,
        badge: ch === 'badge' ? !current : p[cat].badge,
      },
    };
    try {
      const result = await this.prefsService.updateLegacyPreferences(update);
      this.prefs.set(result.preferences);
      this.saved.set(true);
    } catch {
      this.error.set(this.i18n.translate('common.error_generic'));
    }
  }
}
