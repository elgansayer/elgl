import { Component, inject, signal, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import {
  NotificationPreferencesService,
  type NotificationPreferences,
  type PreferenceChannel,
  type NotificationCategory,
  type NotificationChannel,
} from '../../services/notification-preferences.service';

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
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

  readonly channels: NotificationChannel[] = ['push', 'badge'];

  private prefs = signal<NotificationPreferences | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly categories = signal<NotificationCategory[]>([
    'direct_messages',
    'groups',
    'likes',
    'voice_rooms',
  ]);

  readonly doNotDisturb = signal(false);

  private readonly prefsResource = resource({
    loader: async () => {
      this.loading.set(true);
      this.error.set(null);
      try {
        const prefs = await this.service.getPreferences();
        this.prefs.set(prefs);
        this.doNotDisturb.set(prefs.do_not_disturb);
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

  private categoryPref(cat: NotificationCategory): PreferenceChannel | undefined {
    const p = this.prefs();
    if (!p) return undefined;
    return p[cat];
  }

  channelEnabled(cat: NotificationCategory, ch: NotificationChannel): boolean {
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

  toggle(cat: NotificationCategory, ch: NotificationChannel): void {
    const cp = this.categoryPref(cat);
    if (!cp) return;
    const newVal = !cp[ch];
    const currentPrefs = this.prefs();
    if (!currentPrefs) return;
    this.service.toggleCategoryChannel(cat, ch, newVal, currentPrefs).then((updated) => {
      this.prefs.set(updated);
      this.doNotDisturb.set(updated.do_not_disturb);
    }).catch(() => {
      this.error.set(this.i18n.translate('common.error_generic'));
    });
  }

  toggleDnd(): void {
    const p = this.prefs();
    if (!p) return;
    const newVal = !p.do_not_disturb;
    this.service.updatePreferences({ do_not_disturb: newVal }).then((updated) => {
      this.prefs.set(updated);
      this.doNotDisturb.set(updated.do_not_disturb);
    }).catch(() => {
      this.error.set(this.i18n.translate('common.error_generic'));
    });
  }

  reset(): void {
    this.service.resetToDefaults().then((updated) => {
      this.prefs.set(updated);
      this.doNotDisturb.set(updated.do_not_disturb);
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
    }).catch(() => {
      this.error.set(this.i18n.translate('common.error_generic'));
    });
  }
}
