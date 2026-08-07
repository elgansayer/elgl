import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import {
  NotificationPreferencesService,
  NotificationPreferences,
  NotificationCategory,
} from '../../../services/notification-preferences.service';
import { I18nService } from '../../../services/i18n.service';

interface NotificationSettingItem {
  category: NotificationCategory;
  labelKey: string;
  icon: string;
  push: boolean;
  badges: boolean;
}

@Component({
  standalone: true,
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.component.html',
  imports: [TranslatePipe],
})
export class NotificationSettingsComponent {
  private readonly prefsService = inject(NotificationPreferencesService);
  private readonly i18n = inject(I18nService);
  private readonly location = inject(Location);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);

  readonly categories: NotificationCategory[] = [
    'new_message',
    'moment_like',
    'audio_room_invite',
    'new_follower',
  ];

  readonly settings = signal<NotificationSettingItem[]>([]);

  private prefs = signal<NotificationPreferences | null>(null);

  constructor() {
    void this.loadPreferences();
  }

  private async loadPreferences(): Promise<void> {
    this.loading.set(true);
    try {
      const prefs = await this.prefsService.getPreferences();
      this.prefs.set(prefs);
      this.settings.set(this.buildSettings(prefs));
    } catch {
      this.error.set(this.i18n.translate('common.error_generic'));
    } finally {
      this.loading.set(false);
    }
  }

  private buildSettings(prefs: NotificationPreferences): NotificationSettingItem[] {
    return this.categories.map((cat) => {
      const cp = this.getCategoryPref(prefs, cat);
      return {
        category: cat,
        labelKey: `notification_settings.category.${cat}`,
        icon: this.categoryIcon(cat),
        push: cp.push,
        badges: cp.badges,
      };
    });
  }

  private getCategoryPref(
    prefs: NotificationPreferences,
    cat: NotificationCategory,
  ): { push: boolean; badges: boolean } {
    switch (cat) {
      case 'new_message':
        return { push: prefs.new_message.push, badges: prefs.new_message.badges };
      case 'moment_like':
        return { push: prefs.moment_like.push, badges: prefs.moment_like.badges };
      case 'audio_room_invite':
        return { push: prefs.audio_room_invite.push, badges: prefs.audio_room_invite.badges };
      case 'new_follower':
        return { push: prefs.new_follower.push, badges: prefs.new_follower.badges };
      default:
        return { push: true, badges: true };
    }
  }

  private categoryIcon(cat: NotificationCategory): string {
    const icons: Record<string, string> = {
      new_message: 'direct-message',
      moment_like: 'heart',
      audio_room_invite: 'microphone',
      new_follower: 'person-add',
      call_invite: 'phone',
      moment_comment: 'comment',
      correction: 'edit',
      gift: 'gift',
      profile_view: 'eye',
      study_reminder: 'book',
      friend_request: 'handshake',
    };
    return icons[cat] ?? 'bell';
  }

  togglePush(item: NotificationSettingItem): void {
    item.push = !item.push;
  }

  toggleBadges(item: NotificationSettingItem): void {
    item.badges = !item.badges;
  }

  async savePreferences(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    this.saved.set(false);

    const currentPrefs = this.prefs();
    if (!currentPrefs) {
      this.error.set(this.i18n.translate('common.error_generic'));
      this.saving.set(false);
      return;
    }

    const update: Partial<NotificationPreferences> = {};

    for (const item of this.settings()) {
      update[item.category] = {
        push: item.push,
        email: currentPrefs[item.category].email,
        in_app: currentPrefs[item.category].in_app,
        badges: item.badges,
      };
    }

    try {
      const updated = await this.prefsService.updatePreferences(update);
      this.prefs.set(updated);
      this.settings.set(this.buildSettings(updated));
      this.saved.set(true);
    } catch {
      this.error.set(this.i18n.translate('common.error_generic'));
    } finally {
      this.saving.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
