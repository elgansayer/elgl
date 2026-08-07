import { Component, inject, computed, signal, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EventsService, Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  imports: [TranslatePipe],
  standalone: true,
  template: `
    <div class="min-h-screen bg-[#121212] text-white p-4">
      <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-bold mb-4">{{ 'components.events-calendar.eventCalendar' | t }}</h1>
        <div class="flex items-center justify-between mb-6">
          <button
            class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
            (click)="previousMonth()"
          >
            &lt; Prev
          </button>
          <span class="text-lg font-semibold">{{ monthLabel() }}</span>
          <button
            class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
            (click)="nextMonth()"
          >
            Next &gt;
          </button>
        </div>

        <!-- Day names -->
        <div class="grid grid-cols-7 mb-2">
          @for (name of dayNames; track name) {
            <div class="text-center text-sm font-medium text-gray-400">
              {{ name }}
            </div>
          }
        </div>

        <!-- Calendar grid -->
        <div class="grid grid-cols-7 gap-y-2 gap-x-1">
          @for (day of days(); track $index) {
            <div
              class="flex flex-col items-center justify-center min-h-[80px] p-1 rounded hover:bg-gray-800 transition-colors"
              [class.text-gray-500]="!day"
              [class.bg-gray-900]="!!day && eventsByDate().has(day)"
            >
              @if (day) {
                <span class="text-sm font-medium">{{ day }}</span>
                @if (eventsByDate().has(day)) {
                  <div class="mt-1 space-y-0.5">
                    @for (ev of eventsByDate().get(day)!.slice(0, 2); track ev.id) {
                      <span
                        class="block text-[10px] leading-tight truncate max-w-[40px] bg-blue-600/50 text-blue-200 px-0.5 rounded"
                      >
                        {{ ev.title }}
                      </span>
                    }
                    @if (eventsByDate().get(day)!.length > 2) {
                      <span class="text-[10px] text-gray-400"
                        >+{{ eventsByDate().get(day)!.length - 2 }}</span
                      >
                    }
                  </div>
                }
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class EventsCalendarComponent {
  private eventsService = inject(EventsService);

  dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  monthOffset = signal<number>(0);

  monthStart = computed(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + this.monthOffset(), 1);
  });

  monthLabel = computed(() => {
    const start = this.monthStart();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[start.getMonth()]} ${start.getFullYear()}`;
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

  previousMonth() {
    this.monthOffset.update(o => o - 1);
  }

  nextMonth() {
    this.monthOffset.update(o => o + 1);
  }
}
