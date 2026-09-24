import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, resource, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import {
  NotificationPreferencesService,
  NotificationPreferences,
  CategoryPreference,
  NotificationCategory,
  NotificationChannel,
  UpdateNotificationPreferences,
} from '../../services/notification-preferences.service';

const QUIET_HOURS_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

@Component({
  selector: 'app-notification-preferences',
  imports: [HlmCheckbox, HlmInput, HlmButton, TranslatePipe],
  template: `
    <div class="bg-surface-200 border border-surface-100 p-4 rounded-lg max-w-2xl mx-auto">
      <h2 class="text-xl font-bold mb-4">{{ 'notification_preferences.title' | t }}</h2>

      @if (loading()) {
        <div class="text-center py-8" role="status" aria-live="polite">
          {{ 'common.loading' | t }}
        </div>
      } @else if (loadError()) {
        <div class="text-danger" role="alert">{{ 'common.error_generic' | t }}</div>
      } @else {
        @for (cat of categories(); track cat) {
          <div class="flex items-center justify-between py-3 border-b border-surface-100 gap-4">
            <span class="text-sm font-medium">{{ categoryLabel(cat) | t }}</span>
            <div class="flex flex-wrap justify-end gap-4">
              @for (ch of channels; track ch) {
                <label class="flex items-center gap-1 cursor-pointer min-h-11">
                  <hlm-checkbox
                    [checked]="channelEnabled(cat, ch)"
                    [disabled]="saving()"
                    (change)="toggle(cat, ch)"
                    class="accent-primary h-4 w-4 rounded"
                  />
                  <span class="text-xs">{{ channelLabel(ch) | t }}</span>
                </label>
              }
            </div>
          </div>
        }

        <div class="mt-6 pt-4 border-t border-surface-100">
          <label class="flex items-center gap-2 mb-4 min-h-11">
            <hlm-checkbox
              [checked]="doNotDisturb()"
              [disabled]="saving()"
              (change)="toggleDnd()"
              class="accent-primary h-4 w-4 rounded"
            />
            <span>{{ 'notification_preferences.do_not_disturb' | t }}</span>
          </label>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs mb-1" for="quiet-hours-start">{{
                'notification_preferences.quiet_hours_start' | t
              }}</label>
              <input
                hlmInput
                id="quiet-hours-start"
                type="time"
                [value]="quietStart()"
                [disabled]="saving()"
                (input)="updateQuietStart($event)"
                class="w-full rounded-app border border-surface-100 bg-surface-300 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label class="block text-xs mb-1" for="quiet-hours-end">{{
                'notification_preferences.quiet_hours_end' | t
              }}</label>
              <input
                hlmInput
                id="quiet-hours-end"
                type="time"
                [value]="quietEnd()"
                [disabled]="saving()"
                (input)="updateQuietEnd($event)"
                class="w-full rounded-app border border-surface-100 bg-surface-300 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        @if (actionError()) {
          <p class="mt-4 text-sm text-danger" role="alert">
            {{ 'common.error_generic' | t }}
          </p>
        }
        @if (statusMessage()) {
          <p class="mt-4 text-sm text-text-secondary" role="status" aria-live="polite">
            {{ statusMessage() }}
          </p>
        }
        @if (saving()) {
          <p class="mt-4 text-sm text-text-secondary" role="status" aria-live="polite">
            {{ 'common.saving' | t }}
          </p>
        }

        <div class="mt-6 flex flex-wrap gap-3">
          <button
            hlmBtn
            type="button"
            [disabled]="saving()"
            (click)="reset()"
            class="rounded-app border border-surface-100 text-text-secondary hover:bg-surface-300 transition-colors px-4 py-2 text-sm font-semibold min-h-11"
          >
            {{ 'common.reset' | t }}
          </button>
          <button
            hlmBtn
            type="button"
            [disabled]="saving() || !dirty()"
            (click)="save()"
            class="rounded-app bg-primary text-on-fill hover:bg-primary/90 transition-colors px-4 py-2 text-sm font-semibold min-h-11"
          >
            {{ 'common.save' | t }}
          </button>
        </div>
      }
    </div>
  `,
})
export class NotificationPreferencesComponent {
  private readonly service = inject(NotificationPreferencesService);
  private readonly i18n = inject(I18nService);

  readonly channels: NotificationChannel[] = ['push', 'email', 'in_app', 'badges'];

  private readonly prefs = signal<NotificationPreferences | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly actionError = signal(false);
  readonly statusMessage = signal<string | null>(null);
  readonly dirty = signal(false);
  readonly saving = signal(false);

  readonly categories = signal<NotificationCategory[]>([
    'new_message',
    'call_invite',
    'moment_like',
    'moment_comment',
    'correction',
    'gift',
    'profile_view',
    'study_reminder',
    'friend_request',
    'audio_room_invite',
    'new_follower',
  ]);

  readonly doNotDisturb = signal(false);
  readonly quietStart = signal('');
  readonly quietEnd = signal('');

  readonly prefsResource = resource({
    loader: async () => {
      this.loading.set(true);
      this.loadError.set(false);
      try {
        const prefs = await this.service.getPreferences();
        this.applyPreferences(prefs);
      } catch {
        this.loadError.set(true);
      } finally {
        this.loading.set(false);
      }
      return this.prefs();
    },
  });

  private categoryPref(cat: NotificationCategory): CategoryPreference | undefined {
    return this.prefs()?.[cat];
  }

  channelEnabled(cat: NotificationCategory, ch: NotificationChannel): boolean {
    return this.categoryPref(cat)?.[ch] ?? false;
  }

  categoryLabel(cat: NotificationCategory): string {
    return `notification_preferences.category.${cat}`;
  }

  channelLabel(ch: NotificationChannel): string {
    return `notification_preferences.channel.${ch}`;
  }

  toggle(cat: NotificationCategory, ch: NotificationChannel): void {
    if (this.saving()) return;

    this.prefs.update((prefs) => {
      if (!prefs) return prefs;
      return {
        ...prefs,
        [cat]: {
          ...prefs[cat],
          [ch]: !prefs[cat][ch],
        },
      };
    });
    this.markDirty();
  }

  toggleDnd(): void {
    if (this.saving()) return;
    this.doNotDisturb.update((enabled) => !enabled);
    this.markDirty();
  }

  updateQuietStart(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.quietStart.set(target.value);
      this.markDirty();
    }
  }

  updateQuietEnd(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.quietEnd.set(target.value);
      this.markDirty();
    }
  }

  async reset(): Promise<void> {
    if (this.saving()) return;

    this.saving.set(true);
    this.actionError.set(false);
    this.statusMessage.set(null);
    try {
      const updated = await this.service.resetToDefaults();
      this.applyPreferences(updated);
      this.statusMessage.set(this.i18n.translate('notification_settings.saved_message'));
    } catch {
      this.actionError.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  async save(): Promise<void> {
    const prefs = this.prefs();
    if (!prefs || this.saving() || !this.dirty()) return;

    const start = this.quietStart().trim();
    const end = this.quietEnd().trim();
    if (!this.quietHoursAreValid(start, end)) {
      this.actionError.set(true);
      this.statusMessage.set(null);
      return;
    }

    this.saving.set(true);
    this.actionError.set(false);
    this.statusMessage.set(null);
    try {
      const updated = await this.service.updatePreferences(
        this.buildSavePayload(prefs, start, end),
      );
      this.applyPreferences(updated);
      this.statusMessage.set(this.i18n.translate('notification_settings.saved_message'));
    } catch {
      this.actionError.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private buildSavePayload(
    prefs: NotificationPreferences,
    start: string,
    end: string,
  ): UpdateNotificationPreferences {
    const payload: UpdateNotificationPreferences = {
      do_not_disturb: this.doNotDisturb(),
      quiet_hours_start: start || null,
      quiet_hours_end: end || null,
      quiet_hours_timezone: start && end ? this.browserTimeZone() : null,
    };

    for (const category of this.categories()) {
      payload[category] = { ...prefs[category] };
    }

    return payload;
  }

  private quietHoursAreValid(start: string, end: string): boolean {
    if (!start && !end) return true;
    if (!start || !end) return false;
    if (!QUIET_HOURS_TIME_PATTERN.test(start)) return false;
    if (!QUIET_HOURS_TIME_PATTERN.test(end)) return false;
    return start !== end;
  }

  private browserTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  private applyPreferences(updated: NotificationPreferences): void {
    this.prefs.set(updated);
    this.doNotDisturb.set(updated.do_not_disturb);
    this.quietStart.set(updated.quiet_hours_start ?? '');
    this.quietEnd.set(updated.quiet_hours_end ?? '');
    this.dirty.set(false);
    this.actionError.set(false);
  }

  private markDirty(): void {
    this.dirty.set(true);
    this.actionError.set(false);
    this.statusMessage.set(null);
  }
}
