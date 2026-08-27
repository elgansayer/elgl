import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
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

interface DndSchedule {
  do_not_disturb: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

@Component({
  selector: 'app-notification-preferences',
  imports: [HlmCheckbox, HlmInput, HlmButton, TranslatePipe],
  template: `
    <div class="bg-surface-200 border border-surface-100 p-4 rounded-lg max-w-2xl mx-auto">
      <h2 class="text-xl font-bold mb-4">{{ 'notification_preferences.title' | t }}</h2>

      @if (loading()) {
        <div class="text-center py-8">{{ 'common.loading' | t }}</div>
      } @else if (error()) {
        <div class="text-danger">{{ 'common.error_generic' | t }}</div>
      } @else {
        @for (cat of categories(); track cat) {
          <div class="flex items-center justify-between py-3 border-b border-surface-100">
            <span class="text-sm font-medium">{{ categoryLabel(cat) | t }}</span>
            <div class="flex gap-4">
              @for (ch of channels; track ch) {
                <label class="flex items-center gap-1 cursor-pointer">
                  <hlm-checkbox
                    [checked]="channelEnabled(cat, ch)"
                    [disabled]="mutationPending()"
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
          <label class="flex items-center gap-2 mb-4">
            <hlm-checkbox
              [checked]="doNotDisturb()"
              [disabled]="mutationPending()"
              (change)="toggleDnd()"
              class="accent-primary h-4 w-4 rounded"
            />
            <span>{{ 'notification_preferences.do_not_disturb' | t }}</span>
          </label>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs mb-1" for="quiet-hours-start">{{
                'notification_preferences.quiet_hours_start' | t
              }}</label>
              <input
                hlmInput
                id="quiet-hours-start"
                type="time"
                [value]="quietStart()"
                [disabled]="mutationPending()"
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
                [disabled]="mutationPending()"
                (input)="updateQuietEnd($event)"
                class="w-full rounded-app border border-surface-100 bg-surface-300 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <div class="mt-6 flex gap-3">
          <button
            hlmBtn
            type="button"
            [disabled]="mutationPending()"
            (click)="reset()"
            class="rounded-app border border-surface-100 text-text-secondary hover:bg-surface-300 transition-colors px-4 py-2 text-sm font-semibold"
          >
            {{ 'common.reset' | t }}
          </button>
          <button
            hlmBtn
            type="button"
            [disabled]="mutationPending()"
            (click)="save()"
            class="rounded-app bg-primary text-on-fill hover:bg-primary/90 transition-colors px-4 py-2 text-sm font-semibold"
          >
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
  readonly mutationPending = signal(false);

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
        this.applyPreferences(prefs);
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
    return p?.[cat];
  }

  private currentDndSchedule(): DndSchedule {
    return {
      do_not_disturb: this.doNotDisturb(),
      quiet_hours_start: this.quietStart(),
      quiet_hours_end: this.quietEnd(),
    };
  }

  private applyPreferences(updated: NotificationPreferences): void {
    this.prefs.set(updated);
    this.doNotDisturb.set(updated.do_not_disturb);
    this.quietStart.set(updated.quiet_hours_start ?? '');
    this.quietEnd.set(updated.quiet_hours_end ?? '');
  }

  private runMutation(
    request: () => Promise<NotificationPreferences>,
    onSuccess: (updated: NotificationPreferences) => void,
  ): void {
    if (this.mutationPending()) return;
    this.mutationPending.set(true);
    this.error.set(null);
    request()
      .then(onSuccess)
      .catch(() => {
        this.error.set(this.i18n.translate('common.error_generic'));
      })
      .finally(() => {
        this.mutationPending.set(false);
      });
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
    const p = this.prefs();
    if (!p || this.mutationPending()) return;
    const cp = this.categoryPref(cat);
    if (!cp) return;
    const newVal = !cp[ch];
    const dndSchedule = this.currentDndSchedule();
    this.runMutation(
      () => this.service.toggleCategoryChannel(cat, ch, newVal, p),
      (updated) => {
        this.prefs.set(updated);
        this.doNotDisturb.set(dndSchedule.do_not_disturb);
        this.quietStart.set(dndSchedule.quiet_hours_start);
        this.quietEnd.set(dndSchedule.quiet_hours_end);
      },
    );
  }

  toggleDnd(): void {
    const p = this.prefs();
    if (!p || this.mutationPending()) return;
    const newVal = !p.do_not_disturb;
    this.runMutation(
      () => this.service.toggleDoNotDisturb(newVal, this.quietStart(), this.quietEnd()),
      (updated) => this.applyPreferences(updated),
    );
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
    this.runMutation(
      () => this.service.resetToDefaults(),
      (updated) => this.applyPreferences(updated),
    );
  }

  save(): void {
    const p = this.prefs();
    if (!p || this.mutationPending()) return;
    const dndSchedule = this.currentDndSchedule();
    this.runMutation(
      () => this.service.updatePreferences(dndSchedule),
      (updated) => this.applyPreferences(updated),
    );
  }
}
