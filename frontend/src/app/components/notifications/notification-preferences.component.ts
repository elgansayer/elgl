import { Component, inject, signal, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import {
  NotificationPreferencesService,
  NotificationPreferences,
  NotificationCategory,
  NotificationChannel,
} from '../../../services/notification-preferences.service';

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  host: {
    '[class]':
      "'block w-full max-w-2xl mx-auto p-4 bg-surface dark:bg-surface-dark text-on-surface dark:text-on-surface-dark'",
  },
  template: `
    <h2 class="text-xl font-bold mb-4">{{ 'notificationPreferences.heading' | t }}</h2>

    @if (loading()) {
      <div class="flex justify-center py-8">
        <span class="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full"></span>
      </div>
    } @else {
      @if (error(); as err) {
        <div class="bg-error/20 border border-s border-error rounded p-3 mb-4" role="alert">
          <p class="text-sm text-error">{{ err }}</p>
        </div>
      }

      <div class="space-y-4">
        @for (cat of categories; track cat.key) {
          <fieldset class="border border-s border-outline dark:border-outline-dark rounded p-4">
            <legend class="text-sm font-semibold mb-2">{{ cat.labelKey | t }}</legend>
            <div class="flex gap-4 items-center">
              <label class="flex items-center gap-1">
                <input
                  type="checkbox"
                  [checked]="channelEnabled(cat.key, 'push')"
                  (change)="toggleChannel(cat.key, 'push', $event)"
                  class="form-checkbox h-4 w-4 accent-accent"
                />
                <span>{{ 'notificationPreferences.push' | t }}</span>
              </label>
              <label class="flex items-center gap-1">
                <input
                  type="checkbox"
                  [checked]="channelEnabled(cat.key, 'email')"
                  (change)="toggleChannel(cat.key, 'email', $event)"
                  class="form-checkbox h-4 w-4 accent-accent"
                />
                <span>{{ 'notificationPreferences.email' | t }}</span>
              </label>
              <label class="flex items-center gap-1">
                <input
                  type="checkbox"
                  [checked]="channelEnabled(cat.key, 'in_app')"
                  (change)="toggleChannel(cat.key, 'in_app', $event)"
                  class="form-checkbox h-4 w-4 accent-accent"
                />
                <span>{{ 'notificationPreferences.inApp' | t }}</span>
              </label>
            </div>
          </fieldset>
        }

        <!-- Do Not Disturb & Quiet Hours -->
        <fieldset class="border border-s border-outline dark:border-outline-dark rounded p-4 mt-6">
          <legend class="text-sm font-semibold mb-2">{{ 'notificationPreferences.doNotDisturb' | t }}</legend>
          <label class="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              [checked]="preferences()?.do_not_disturb === true"
              (change)="toggleDoNotDisturb($event)"
              class="form-checkbox h-4 w-4 accent-accent"
            />
            <span>{{ 'notificationPreferences.enableDnd' | t }}</span>
          </label>

          @if (preferences()?.do_not_disturb) {
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm mb-1">{{ 'notificationPreferences.startTime' | t }}</label>
                <input
                  type="time"
                  [value]="preferences()?.quiet_hours_start ?? ''"
                  (change)="onQuietHoursStartChange($any($event.target).value)"
                  class="w-full border border-s border-outline dark:border-outline-dark rounded p-1"
                />
              </div>
              <div>
                <label class="block text-sm mb-1">{{ 'notificationPreferences.endTime' | t }}</label>
                <input
                  type="time"
                  [value]="preferences()?.quiet_hours_end ?? ''"
                  (change)="onQuietHoursEndChange($any($event.target).value)"
                  class="w-full border border-s border-outline dark:border-outline-dark rounded p-1"
                />
              </div>
            </div>
          }
        </fieldset>

        <!-- Reset to defaults -->
        <div class="pt-4 border-t border-s border-outline dark:border-outline-dark">
          <button
            type="button"
            (click)="resetPreferences()"
            class="text-sm underline text-accent hover:text-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            {{ 'notificationPreferences.reset' | t }}
          </button>
        </div>
      </div>
    }
  `,
})
export class NotificationPreferencesComponent {
  private readonly preferencesService = inject(NotificationPreferencesService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly preferences = signal<NotificationPreferences | null>(null);

  readonly categories: { key: NotificationCategory; labelKey: string }[] = [
    { key: 'new_message', labelKey: 'notificationPreferences.newMessage' },
    { key: 'call_invite', labelKey: 'notificationPreferences.callInvite' },
    { key: 'moment_like', labelKey: 'notificationPreferences.momentLike' },
    { key: 'moment_comment', labelKey: 'notificationPreferences.momentComment' },
    { key: 'correction', labelKey: 'notificationPreferences.correction' },
    { key: 'gift', labelKey: 'notificationPreferences.gift' },
    { key: 'profile_view', labelKey: 'notificationPreferences.profileView' },
    { key: 'study_reminder', labelKey: 'notificationPreferences.studyReminder' },
    { key: 'friend_request', labelKey: 'notificationPreferences.friendRequest' },
    { key: 'audio_room_invite', labelKey: 'notificationPreferences.audioRoomInvite' },
  ];

  constructor() {
    afterNextRender(() => {
      this.loadPreferences();
    });
  }

  channelEnabled(category: NotificationCategory, channel: NotificationChannel): boolean {
    const prefs = this.preferences();
    if (!prefs) return false;
    const pref = prefs[category];
    if (!pref) return false;
    return pref[channel] ?? false;
  }

  private async loadPreferences(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const prefs = await this.preferencesService.getPreferences();
      this.preferences.set(prefs);
    } catch (e) {
      console.error(e);
      this.error.set('Failed to load notification preferences. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleChannel(category: NotificationCategory, channel: NotificationChannel, event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const enabled = target.checked;
    const current = this.preferences();
    if (!current) return;
    try {
      const updated = await this.preferencesService.toggleCategoryChannel(category, channel, enabled, current);
      this.preferences.set(updated);
    } catch {
      this.error.set('Failed to update preference. Please try again.');
    }
  }

  async toggleDoNotDisturb(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const enabled = target.checked;
    const current = this.preferences();
    try {
      const updated = await this.preferencesService.toggleDoNotDisturb(
        enabled,
        current?.quiet_hours_start,
        current?.quiet_hours_end,
      );
      this.preferences.set(updated);
    } catch {
      this.error.set('Failed to update Do Not Disturb preferences.');
    }
  }

  async onQuietHoursStartChange(value: string): Promise<void> {
    const current = this.preferences();
    if (!current) return;
    try {
      const updated = await this.preferencesService.toggleDoNotDisturb(
        current.do_not_disturb,
        value,
        current.quiet_hours_end,
      );
      this.preferences.set(updated);
    } catch {
      this.error.set('Failed to update quiet hours.');
    }
  }

  async onQuietHoursEndChange(value: string): Promise<void> {
    const current = this.preferences();
    if (!current) return;
    try {
      const updated = await this.preferencesService.toggleDoNotDisturb(
        current.do_not_disturb,
        current.quiet_hours_start,
        value,
      );
      this.preferences.set(updated);
    } catch {
      this.error.set('Failed to update quiet hours.');
    }
  }

  async resetPreferences(): Promise<void> {
    this.error.set(null);
    try {
      const prefs = await this.preferencesService.resetToDefaults();
      this.preferences.set(prefs);
    } catch {
      this.error.set('Failed to reset preferences to defaults.');
    }
  }
}
