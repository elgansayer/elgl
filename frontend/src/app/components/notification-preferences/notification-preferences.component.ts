import { Component, inject, signal, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import {
  NotificationPreferencesService,
  NotificationPreferences,
  CategoryPreference,
  NotificationCategory,
  NotificationChannel,
} from '../../services/notification-preferences.service';

@Component({
  selector: 'app-notification-preferences',
  imports: [TranslatePipe],
  template: `
    <div class="surface p-4 rounded-lg max-w-2xl mx-auto">
      <h2 class="text-xl font-bold mb-4">{{ 'notification_preferences.title' | t }}</h2>

      @if (loading()) {
        <div class="text-center py-8">{{ 'common.loading' | t }}</div>
      } @else if (error()) {
        <div class="text-red-400">{{ 'common.error_generic' | t }}</div>
      } @else {
        @for (cat of categories(); track cat) {
          <div class="flex items-center justify-between py-3 border-b border-slate-700">
            <span class="text-sm font-medium">{{ categoryLabel(cat) | t }}</span>
            <div class="flex gap-4">
              @for (ch of channels; track ch) {
                <label class="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    [checked]="channelEnabled(cat, ch)"
                    (change)="toggle(cat, ch)"
                    class="form-checkbox"
                  />
                  <span class="text-xs">{{ channelLabel(ch) | t }}</span>
                </label>
              }
            </div>
          </div>
        }

        <div class="mt-6 pt-4 border-t border-slate-700">
          <label class="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              [checked]="doNotDisturb()"
              (change)="toggleDnd()"
              class="form-checkbox"
            />
            <span>{{ 'notification_preferences.do_not_disturb' | t }}</span>
          </label>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs mb-1" for="quiet-hours-start">{{ 'notification_preferences.quiet_hours_start' | t }}</label>
              <input
                id="quiet-hours-start"
                type="time"
                [value]="quietStart()"
                (input)="updateQuietStart($event)"
                class="input w-full"
              />
            </div>
            <div>
              <label class="block text-xs mb-1" for="quiet-hours-end">{{ 'notification_preferences.quiet_hours_end' | t }}</label>
              <input
                id="quiet-hours-end"
                type="time"
                [value]="quietEnd()"
                (input)="updateQuietEnd($event)"
                class="input w-full"
              />
            </div>
          </div>
        </div>

        <div class="mt-6 flex gap-3">
          <button type="button" (click)="reset()" class="btn-secondary px-4 py-2">
            {{ 'common.reset' | t }}
          </button>
          <button type="button" (click)="save()" class="btn-primary px-4 py-2">
            {{ 'common.save' | t }}
          </button>
        </div>
      }
    </div>
  `,
})
export class NotificationPreferencesComponent {
  private service = inject(NotificationPreferencesService);
  private i18n = inject(I18nService);

  readonly channels: Array<'push' | 'badge'> = ['push', 'badge'];

  private prefs = signal<NotificationPreferences | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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

  private readonly prefsResource = resource({
    loader: async () => {
      this.loading.set(true);
      this.error.set(null);
      try {
        const prefs = await this.service.getPreferences();
        this.prefs.set(prefs);
        this.doNotDisturb.set(prefs.do_not_disturb);
        this.quietStart.set(prefs.quiet_hours_start ?? '');
        this.quietEnd.set(prefs.quiet_hours_end ?? '');
      } catch {
        this.error.set(this.i18n.translate('common.error_generic'));
      } finally {
        this.loading.set(false);
      }
      return this.prefs();
    },
  });

  constructor() {
    this.prefsResource.reload();
  }

  private categoryPref(cat: NotificationCategory): CategoryPreference | undefined {
    const p = this.prefs();
    if (!p) return undefined;
    // explicit switch to avoid any / type assertion
    switch (cat) {
      case 'new_message': return p.new_message;
      case 'call_invite': return p.call_invite;
      case 'moment_like': return p.moment_like;
      case 'moment_comment': return p.moment_comment;
      case 'correction': return p.correction;
      case 'gift': return p.gift;
      case 'profile_view': return p.profile_view;
      case 'study_reminder': return p.study_reminder;
      case 'friend_request': return p.friend_request;
      case 'audio_room_invite': return p.audio_room_invite;
      case 'new_follower': return p.new_follower;
      default: return undefined;
    }
  }

  channelEnabled(cat: NotificationCategory, ch: 'push' | 'badge'): boolean {
    const cp = this.categoryPref(cat);
    if (!cp) return false;
    return cp[ch];
  }

  categoryLabel(cat: NotificationCategory): string {
    return `notification_preferences.category.${cat}`;
  }

  channelLabel(ch: NotificationChannel): string {
    return `notification_preferences.channel.${ch}`;
  }

  toggle(cat: NotificationCategory, ch: 'push' | 'badge'): void {
    const cp = this.categoryPref(cat);
    if (!cp) return;
    const newVal = !cp[ch];
    this.service.toggleCategoryChannel(cat, ch, newVal, this.prefs()!).then((updated) => {
      this.prefs.set(updated);
      this.doNotDisturb.set(updated.do_not_disturb);
      this.quietStart.set(updated.quiet_hours_start ?? '');
      this.quietEnd.set(updated.quiet_hours_end ?? '');
    }).catch(() => {
      this.error.set(this.i18n.translate('common.error_generic'));
    });
  }

  toggleDnd(): void {
    const p = this.prefs();
    if (!p) return;
    const newVal = !p.do_not_disturb;
    this.service.toggleDoNotDisturb(newVal, this.quietStart(), this.quietEnd()).then((updated) => {
      this.prefs.set(updated);
      this.doNotDisturb.set(updated.do_not_disturb);
      this.quietStart.set(updated.quiet_hours_start ?? '');
      this.quietEnd.set(updated.quiet_hours_end ?? '');
    }).catch(() => {
      this.error.set(this.i18n.translate('common.error_generic'));
    });
  }

  updateQuietStart(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.quietStart.set(target.value);
    }
  }

  updateQuietEnd(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.quietEnd.set(target.value);
    }
  }

  reset(): void {
    this.service.resetToDefaults().then((updated) => {
      this.prefs.set(updated);
      this.doNotDisturb.set(updated.do_not_disturb);
      this.quietStart.set(updated.quiet_hours_start ?? '');
      this.quietEnd.set(updated.quiet_hours_end ?? '');
    }).catch(() => {
      this.error.set(this.i18n.translate('common.error_generic'));
    });
  }

  save(): void {
    const p = this.prefs();
    if (!p) return;
    this.service.updatePreferences(p).then((updated) => {
      this.prefs.set(updated);
      this.doNotDisturb.set(updated.do_not_disturb);
      this.quietStart.set(updated.quiet_hours_start ?? '');
      this.quietEnd.set(updated.quiet_hours_end ?? '');
    }).catch(() => {
      this.error.set(this.i18n.translate('common.error_generic'));
    });
  }
}
