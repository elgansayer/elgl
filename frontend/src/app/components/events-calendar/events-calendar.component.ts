import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, computed, signal, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { EventsService, type Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppCardComponent } from '../primitives/card/card.component';

const CALENDAR_EVENT_LIMIT = 100;

@Component({
  imports: [HlmButton, TranslatePipe, RouterLink, AppEmptyStateComponent, AppCardComponent],
  template: `
    <div
      class="min-h-screen bg-surface-500 text-text-primary p-4"
      [attr.aria-busy]="eventsResource.isLoading() ? 'true' : null"
    >
      <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold mb-6">{{ 'events.calendar.title' | t }}</h1>

        @if (eventsResource.isLoading()) {
          <p class="mb-6 text-sm text-text-muted" role="status">
            {{ 'common.loading' | t }}
          </p>
        } @else if (eventsResource.error()) {
          <div class="mb-6 flex flex-col items-start gap-3" role="alert">
            <p class="text-sm text-danger">{{ 'common.error_generic' | t }}</p>
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="touch"
              (click)="retryEvents()"
            >
              {{ 'common.retry' | t }}
            </button>
          </div>
        } @else {
          <div class="flex items-center justify-between gap-3 mb-6">
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="touch"
              [disabled]="monthOffset() <= 0"
              (click)="previousMonth()"
            >
              &lsaquo; {{ 'events.calendar.prev' | t }}
            </button>
            <span class="text-lg font-semibold text-center" aria-live="polite">{{ monthLabel() }}</span>
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="touch"
              (click)="nextMonth()"
            >
              {{ 'events.calendar.next' | t }} &rsaquo;
            </button>
          </div>

          <div class="grid grid-cols-7 mb-2" role="row">
            @for (name of dayNames(); track $index) {
              <div
                class="text-center text-xs font-medium text-text-muted uppercase tracking-wider py-2"
                role="columnheader"
              >
                {{ name }}
              </div>
            }
          </div>

          <div
            class="grid grid-cols-7 gap-px bg-surface-400 rounded-lg overflow-hidden"
            role="grid"
            [attr.aria-label]="monthLabel()"
          >
            @for (day of days(); track $index) {
              @if (day) {
                <button
                  hlmBtn
                  type="button"
                  role="gridcell"
                  class="flex w-full flex-col items-center min-h-[72px] p-1.5 bg-surface-300 text-text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  [attr.aria-label]="
                    'events.calendar.selectDate' | t: { date: formatCalendarDate(day) }
                  "
                  [attr.aria-pressed]="selectedDay() === day"
                  [attr.aria-current]="isToday(day) ? 'date' : null"
                  [class.hover:bg-surface-200]="true"
                  [class.bg-primary/15]="isToday(day)"
                  [class.ring-1]="isToday(day)"
                  [class.ring-primary/50]="isToday(day)"
                  (click)="selectDate(day)"
                >
                  <span class="text-sm font-medium mb-1" [class.text-primary]="isToday(day)">{{
                    day
                  }}</span>
                  @if (eventsByDate().has(day)) {
                    <div class="w-full space-y-0.5" aria-hidden="true">
                      @for (ev of eventsByDate().get(day)!.slice(0, 2); track ev.id) {
                        <div
                          class="text-[10px] leading-tight truncate bg-primary/60 text-on-fill px-1 py-0.5 rounded-sm w-full"
                          [title]="ev.title"
                        >
                          {{ ev.title }}
                        </div>
                      }
                      @if (eventsByDate().get(day)!.length > 2) {
                        <span class="text-[10px] text-text-muted block text-center">
                          {{
                            'events.calendar.moreEvents'
                              | t: { count: eventsByDate().get(day)!.length - 2 }
                          }}
                        </span>
                      }
                    </div>
                  }
                </button>
              } @else {
                <div class="min-h-[72px] bg-surface-300 opacity-30" aria-hidden="true"></div>
              }
            }
          </div>

          @if (selectedDate()) {
            <div class="mt-6">
              <h2 class="text-lg font-semibold mb-3">
                {{ selectedDateLabel() }}
              </h2>
              @if (selectedDateEvents().length === 0) {
                <app-empty-state [description]="'events.calendar.noEvents' | t" />
              }
              <div class="space-y-3">
                @for (ev of selectedDateEvents(); track ev.id) {
                  <app-card>
                    <div class="p-4">
                      <div class="flex items-start justify-between mb-2">
                        <h3 class="font-semibold text-text-primary" dir="auto">{{ ev.title }}</h3>
                        @if (ev.category) {
                          <span class="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            {{ ev.category }}
                          </span>
                        }
                      </div>
                      @if (ev.description) {
                        <p class="text-sm text-text-secondary mb-2" dir="auto">{{ ev.description }}</p>
                      }
                      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                        <span>{{ formatEventTime(ev.date_time) }}</span>
                        @if (ev.location) {
                          <span dir="auto">{{ ev.location }}</span>
                        }
                      </div>
                      <a
                        [routerLink]="['/events', ev.id]"
                        class="inline-block mt-2 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        {{ 'events.calendar.viewDetails' | t }} &rarr;
                      </a>
                    </div>
                  </app-card>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class EventsCalendarComponent {
  private eventsService = inject(EventsService);
  private i18n = inject(I18nService);

  monthOffset = signal<number>(0);
  selectedDay = signal<number | null>(null);
  todayDate = computed(() => new Date());

  monthStart = computed(() => {
    const now = this.todayDate();
    return new Date(now.getFullYear(), now.getMonth() + this.monthOffset(), 1);
  });

  monthRange = computed(() => {
    const start = this.monthStart();
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return {
      from_date: start.toISOString(),
      to_date: end.toISOString(),
      limit: CALENDAR_EVENT_LIMIT,
    };
  });

  monthLabel = computed(() => {
    const start = this.monthStart();
    const locale = this.i18n.currentLang();
    return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  });

  dayNames = computed(() => {
    const locale = this.i18n.currentLang();
    const names: string[] = [];
    const base = new Date(2023, 0, 1);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      names.push(d.toLocaleDateString(locale, { weekday: 'narrow' }));
    }
    return names;
  });

  days = computed(() => {
    const start = this.monthStart();
    const year = start.getFullYear();
    const month = start.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDow = firstDay.getDay();
    const totalCells = startDow + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    for (let i = 0; i < trailing; i++) cells.push(null);
    return cells;
  });

  protected readonly eventsResource = resource<Event[], ReturnType<EventsCalendarComponent['monthRange']>>({
    params: () => this.monthRange(),
    loader: async ({ params }) => {
      const events = await firstValueFrom(this.eventsService.getMyCalendarEvents(params));
      return Array.isArray(events) ? events : [];
    },
  });

  events = computed(() =>
    this.eventsResource.hasValue() ? this.eventsResource.value() : [],
  );

  eventsByDate = computed(() => {
    const map = new Map<number, Event[]>();
    const monthStart = this.monthStart();
    const startYear = monthStart.getFullYear();
    const startMonth = monthStart.getMonth();
    for (const ev of this.events()) {
      if (!ev || ev.is_cancelled || typeof ev.date_time !== 'string') continue;
      const evDate = new Date(ev.date_time);
      if (
        Number.isNaN(evDate.getTime()) ||
        evDate.getFullYear() !== startYear ||
        evDate.getMonth() !== startMonth
      ) {
        continue;
      }
      const day = evDate.getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(ev);
    }
    for (const events of map.values()) {
      events.sort((a, b) => Date.parse(a.date_time) - Date.parse(b.date_time));
    }
    return map;
  });

  selectedDate = computed(() => {
    const day = this.selectedDay();
    if (day === null) return null;
    const start = this.monthStart();
    return new Date(start.getFullYear(), start.getMonth(), day);
  });

  selectedDateLabel = computed(() => {
    const date = this.selectedDate();
    if (!date) return '';
    const locale = this.i18n.currentLang();
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  selectedDateEvents = computed(() => {
    const day = this.selectedDay();
    if (day === null) return [];
    return this.eventsByDate().get(day) ?? [];
  });

  isToday(day: number | null): boolean {
    if (!day) return false;
    const today = this.todayDate();
    const start = this.monthStart();
    return (
      today.getFullYear() === start.getFullYear() &&
      today.getMonth() === start.getMonth() &&
      today.getDate() === day
    );
  }

  formatCalendarDate(day: number): string {
    const start = this.monthStart();
    const date = new Date(start.getFullYear(), start.getMonth(), day);
    const locale = this.i18n.currentLang();
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatEventTime(dateTimeStr: string): string {
    const date = new Date(dateTimeStr);
    if (Number.isNaN(date.getTime())) return '';
    const locale = this.i18n.currentLang();
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  retryEvents(): void {
    if (this.eventsResource.isLoading()) return;
    this.eventsResource.reload();
  }

  selectDate(day: number | null): void {
    if (!day) return;
    this.selectedDay.update((current) => (current === day ? null : day));
  }

  previousMonth(): void {
    if (this.monthOffset() <= 0) return;
    this.selectedDay.set(null);
    this.monthOffset.update((o) => o - 1);
  }

  nextMonth(): void {
    this.selectedDay.set(null);
    this.monthOffset.update((o) => o + 1);
  }
}
