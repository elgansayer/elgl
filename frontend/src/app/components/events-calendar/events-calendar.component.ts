import { Component, inject, computed, signal, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { EventsService, type Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  standalone: true,
  imports: [TranslatePipe, RouterLink, AppEmptyStateComponent, AppCardComponent],
  template: `
    <div class="min-h-screen bg-[#121212] text-white p-4">
      <div class="max-w-2xl mx-auto">
        <!-- Header -->
        <h1 class="text-2xl font-bold mb-6">{{ 'events.calendar.title' | t }}</h1>

        <!-- Month Navigation -->
        <div class="flex items-center justify-between mb-6">
          <button
            class="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm font-medium"
            (click)="previousMonth()"
          >
            &lsaquo; {{ 'events.calendar.prev' | t }}
          </button>
          <span class="text-lg font-semibold">{{ monthLabel() }}</span>
          <button
            class="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm font-medium"
            (click)="nextMonth()"
          >
            {{ 'events.calendar.next' | t }} &rsaquo;
          </button>
        </div>

        <!-- Day names -->
        <div class="grid grid-cols-7 mb-2">
          @for (name of dayNames(); track $index) {
            <div class="text-center text-xs font-medium text-gray-400 uppercase tracking-wider py-2">
              {{ name }}
            </div>
          }
        </div>

        <!-- Calendar grid -->
        <div class="grid grid-cols-7 gap-px bg-gray-800 rounded-lg overflow-hidden">
          @for (day of days(); track $index) {
            <div
              class="flex flex-col items-center min-h-[72px] p-1.5 bg-[#1a1a2e] transition-colors cursor-pointer"
              [class.opacity-30]="!day"
              [class.hover:bg-[#16213e]]="!!day"
              [class.bg-[#0f3460]/40]="!!day && isToday(day)"
              [class.ring-1]="!!day && isToday(day)"
              [class.ring-blue-500/50]="!!day && isToday(day)"
              (click)="day && selectDate(day)"
            >
              @if (day) {
                <span
                  class="text-sm font-medium mb-1"
                  [class.text-blue-400]="isToday(day)"
                >{{ day }}</span>
                @if (eventsByDate().has(day)) {
                  <div class="w-full space-y-0.5">
                    @for (ev of eventsByDate().get(day)!.slice(0, 2); track ev.id) {
                      <div
                        class="text-[10px] leading-tight truncate bg-indigo-600/60 text-indigo-200 px-1 py-0.5 rounded-sm w-full"
                        [title]="ev.title"
                      >
                        {{ ev.title }}
                      </div>
                    }
                    @if (eventsByDate().get(day)!.length > 2) {
                      <span class="text-[10px] text-gray-400 block text-center">
                        {{ 'events.calendar.moreEvents' | t: { count: eventsByDate().get(day)!.length - 2 } }}
                      </span>
                    }
                  </div>
                }
              }
            </div>
          }
        </div>

        <!-- Selected Date Events -->
        @if (selectedDate()) {
          <div class="mt-6">
            <h2 class="text-lg font-semibold mb-3">
              {{ selectedDateLabel() }}
            </h2>
            @if (selectedDateEvents().length === 0) {
              <app-empty-state
                [description]="'events.calendar.noEvents' | t"
              />
            }
            <div class="space-y-3">
              @for (ev of selectedDateEvents(); track ev.id) {
                <app-card>
                  <div class="p-4">
                    <div class="flex items-start justify-between mb-2">
                      <h3 class="font-semibold text-white">{{ ev.title }}</h3>
                      @if (ev.category) {
                        <span class="text-xs bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded-full">
                          {{ ev.category }}
                        </span>
                      }
                    </div>
                    @if (ev.description) {
                      <p class="text-sm text-gray-400 mb-2">{{ ev.description }}</p>
                    }
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span>{{ formatEventTime(ev.date_time) }}</span>
                      @if (ev.location) {
                        <span>{{ ev.location }}</span>
                      }
                    </div>
                    <a
                      [routerLink]="['/events', ev.id]"
                      class="inline-block mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {{ 'events.calendar.viewDetails' | t }} &rarr;
                    </a>
                  </div>
                </app-card>
              }
            </div>
          </div>
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

  monthLabel = computed(() => {
    const start = this.monthStart();
    const locale = this.i18n.currentLang();
    return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  });

  dayNames = computed(() => {
    const locale = this.i18n.currentLang();
    const names: string[] = [];
    // Use 2023-01-01 (a Sunday) to get day names starting from Sunday
    const base = new Date(2023, 0, 1); // Sunday
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
    const startDow = firstDay.getDay(); // 0 = Sunday
    const totalCells = startDow + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    for (let i = 0; i < trailing; i++) cells.push(null);
    return cells;
  });

  private eventsResource = resource<Event[], { status: string }>({
    params: () => ({ status: 'upcoming' }),
    loader: async ({ params }) => {
      const events = await firstValueFrom(
        this.eventsService.getMyEvents(params.status),
      );
      return events ?? [];
    },
  });

  events = computed(() => this.eventsResource.value() ?? []);

  eventsByDate = computed(() => {
    const map = new Map<number, Event[]>();
    const monthStart = this.monthStart();
    const startYear = monthStart.getFullYear();
    const startMonth = monthStart.getMonth();
    for (const ev of this.events()) {
      const evDate = new Date(ev.date_time);
      if (evDate.getFullYear() !== startYear || evDate.getMonth() !== startMonth) {
        continue;
      }
      const day = evDate.getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(ev);
    }
    return map;
  });

  selectedDate = computed(() => {
    const day = this.selectedDay();
    if (day === null) return null;
    const start = this.monthStart();
    const year = start.getFullYear();
    const month = start.getMonth();
    return new Date(year, month, day);
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

  formatEventTime(dateTimeStr: string): string {
    const date = new Date(dateTimeStr);
    const locale = this.i18n.currentLang();
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  selectDate(day: number | null): void {
    if (!day) return;
    this.selectedDay.update(current => (current === day ? null : day));
  }

  previousMonth(): void {
    this.selectedDay.set(null);
    this.monthOffset.update(o => o - 1);
  }

  nextMonth(): void {
    this.selectedDay.set(null);
    this.monthOffset.update(o => o + 1);
  }
}
