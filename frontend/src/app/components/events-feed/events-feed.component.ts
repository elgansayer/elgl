import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { EventsService, Event, EventRsvp } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-events-feed',
  standalone: true,
  imports: [CommonModule, TranslatePipe, DatePipe],
  template: `
    <h1 class="text-2xl font-bold mb-4">{{ 'events.title' | t }}</h1>

    <!-- Filter bar -->
    <div class="flex gap-2 mb-4 items-center flex-wrap">
      <button
        class="px-3 py-1 rounded-full text-sm"
        [class.bg-primary]="status() === 'upcoming'"
        [class.text-white]="status() === 'upcoming'"
        (click)="onStatusChange('upcoming')"
      >{{ 'events.filter_upcoming' | t }}</button>
      <button
        class="px-3 py-1 rounded-full text-sm"
        [class.bg-primary]="status() === 'past'"
        [class.text-white]="status() === 'past'"
        (click)="onStatusChange('past')"
      >{{ 'events.filter_past' | t }}</button>

      <select
        [value]="languagePair() ?? ''"
        (change)="onLanguageChange($any($event.target).value)"
        class="bg-surface border border-border rounded px-2 py-1 text-sm"
      >
        <option value="">{{ 'events.all_languages' | t }}</option>
        <option value="en-es">English ↔ Spanish</option>
        <option value="en-ja">English ↔ Japanese</option>
        <option value="en-ko">English ↔ Korean</option>
        <option value="en-zh">English ↔ Chinese</option>
        <option value="en-fr">English ↔ French</option>
        <option value="en-de">English ↔ German</option>
        <option value="en-ar">English ↔ Arabic</option>
        <option value="en-pt">English ↔ Portuguese</option>
        <option value="en-ru">English ↔ Russian</option>
        <option value="en-it">English ↔ Italian</option>
      </select>
    </div>

    <!-- Event list -->
    @if (isLoading() && events().length === 0) {
      <p>{{ 'loading' | t }}</p>
    } @else {
      <div class="space-y-3">
        @for (event of events(); track event.id) {
          <div class="p-4 bg-surface rounded-lg shadow">
            <h2 class="font-semibold text-lg">{{ event.title }}</h2>
            <p class="text-sm text-text-secondary">
              {{ event.date_time | date:'medium' }}
            </p>
            @if (event.location) {
              <p class="text-xs">{{ event.location }}</p>
            }
            @if (event.host_name) {
              <p class="text-xs">
                {{ 'events.hosted_by' | t : { name: event.host_name } }}
              </p>
            }
            <!-- RSVP counts -->
            <div class="flex items-center gap-3 mt-3 text-xs text-text-secondary">
              <span>{{ 'events.attending_count' | t : { count: (eventAttendeesCount(event)) } }}</span>
              <span>{{ 'events.interested_count' | t : { count: (eventInterestedCount(event)) } }}</span>
            </div>
            <!-- RSVP buttons -->
            <div class="flex items-center gap-2 mt-2">
              @if (rsvpStatuses()[event.id]?.status === 'attending') {
                <button
                  class="px-4 py-1.5 rounded-full text-sm font-medium bg-green-600 text-white"
                  (click)="handleRsvp(event.id, 'attending')"
                >{{ 'events.rsvp_attending_active' | t }}</button>
                <button
                  class="px-3 py-1.5 rounded-full text-sm font-medium bg-surface border border-border text-text-secondary"
                  (click)="handleRsvp(event.id, 'interested')"
                >{{ 'events.rsvp_interested' | t }}</button>
                <button
                  class="px-3 py-1.5 rounded-full text-sm font-medium bg-transparent border border-red-500 text-red-400"
                  (click)="handleRemoveRsvp(event.id)"
                >{{ 'events.rsvp_remove' | t }}</button>
              } @else if (rsvpStatuses()[event.id]?.status === 'interested') {
                <button
                  class="px-3 py-1.5 rounded-full text-sm font-medium bg-surface border border-border text-text-secondary"
                  (click)="handleRsvp(event.id, 'attending')"
                >{{ 'events.rsvp_attending' | t }}</button>
                <button
                  class="px-4 py-1.5 rounded-full text-sm font-medium bg-blue-600 text-white"
                  (click)="handleRsvp(event.id, 'interested')"
                >{{ 'events.rsvp_interested_active' | t }}</button>
                <button
                  class="px-3 py-1.5 rounded-full text-sm font-medium bg-transparent border border-red-500 text-red-400"
                  (click)="handleRemoveRsvp(event.id)"
                >{{ 'events.rsvp_remove' | t }}</button>
              } @else {
                <button
                  class="px-4 py-1.5 rounded-full text-sm font-medium bg-green-600/20 text-green-400 border border-green-500/50"
                  (click)="handleRsvp(event.id, 'attending')"
                >{{ 'events.rsvp_attending' | t }}</button>
                <button
                  class="px-4 py-1.5 rounded-full text-sm font-medium bg-blue-600/20 text-blue-400 border border-blue-500/50"
                  (click)="handleRsvp(event.id, 'interested')"
                >{{ 'events.rsvp_interested' | t }}</button>
              }
            </div>
          </div>
        }
      </div>
      @if (hasMore()) {
        <button
          class="mt-4 w-full py-2 bg-surface border border-border rounded text-sm font-medium disabled:opacity-50"
          [disabled]="isLoading()"
          (click)="loadMore()"
        >
          @if (isLoading()) {
            {{ 'loading' | t }}
          } @else {
            {{ 'events.load_more' | t }}
          }
        </button>
      }
    }
  `,
})
export class EventsFeedComponent implements OnInit {
  private eventsService = inject(EventsService);

  readonly events = signal<Event[]>([]);
  readonly isLoading = signal(false);
  readonly hasMore = signal(true);
  readonly status = signal<'upcoming' | 'past'>('upcoming');
  readonly languagePair = signal<string | undefined>(undefined);
  private page = signal(1);

  readonly rsvpStatuses = signal<Record<string, EventRsvp | null>>({});
  readonly rsvpLoading = signal<Record<string, boolean>>({});

  ngOnInit(): void {
    this.loadEvents(true);
  }

  private async loadEvents(reset = false): Promise<void> {
    this.isLoading.set(true);
    if (reset) {
      this.page.set(1);
      this.events.set([]);
      this.hasMore.set(true);
    }
    try {
      const data = await firstValueFrom(
        this.eventsService.listEvents({
          status: this.status(),
          language_pair: this.languagePair() || undefined,
          page: this.page(),
          limit: 20,
        }),
      );
      if (reset) {
        this.events.set(data);
      } else {
        this.events.update((prev) => [...prev, ...data]);
      }
      if (data.length < 20) {
        this.hasMore.set(false);
      }
      // Fetch RSVP statuses for loaded events
      this.loadRsvps(data);
    } catch {
      // keep current state on error
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadRsvps(eventList: Event[]): Promise<void> {
    for (const ev of eventList) {
      try {
        const rsvp = await firstValueFrom(this.eventsService.getMyRsvp(ev.id));
        this.rsvpStatuses.update((prev) => ({ ...prev, [ev.id]: rsvp }));
      } catch {
        this.rsvpStatuses.update((prev) => ({ ...prev, [ev.id]: null }));
      }
    }
  }

  async handleRsvp(eventId: string, status: 'attending' | 'interested'): Promise<void> {
    const oldRsvp = this.rsvpStatuses()[eventId];
    this.rsvpLoading.update((prev) => ({ ...prev, [eventId]: true }));
    try {
      const rsvp = await firstValueFrom(this.eventsService.rsvp(eventId, status));
      this.rsvpStatuses.update((prev) => ({ ...prev, [eventId]: rsvp }));
      // Update counts locally
      this.updateEventCounts(eventId, status, oldRsvp);
    } catch {
      // keep current state on error
    } finally {
      this.rsvpLoading.update((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  async handleRemoveRsvp(eventId: string): Promise<void> {
    const previousRsvp = this.rsvpStatuses()[eventId];
    this.rsvpLoading.update((prev) => ({ ...prev, [eventId]: true }));
    try {
      await firstValueFrom(this.eventsService.removeRsvp(eventId));
      this.rsvpStatuses.update((prev) => ({ ...prev, [eventId]: null }));
      // Decrement the count locally
      if (previousRsvp) {
        this.decrementEventCount(eventId, previousRsvp.status);
      }
    } catch {
      // keep current state on error
    } finally {
      this.rsvpLoading.update((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  private updateEventCounts(eventId: string, newStatus: 'attending' | 'interested', oldRsvp: EventRsvp | null): void {
    this.events.update((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        let attendees = ev.attendees_count ?? 0;
        let interested = ev.interested_count ?? 0;
        // Decrement old status count if switching
        if (oldRsvp) {
          if (oldRsvp.status === 'attending') attendees = Math.max(0, attendees - 1);
          else interested = Math.max(0, interested - 1);
        }
        // Increment new status count
        if (newStatus === 'attending') attendees += 1;
        else interested += 1;
        return { ...ev, attendees_count: attendees, interested_count: interested };
      }),
    );
  }

  private decrementEventCount(eventId: string, oldStatus: 'attending' | 'interested'): void {
    this.events.update((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        let attendees = ev.attendees_count ?? 0;
        let interested = ev.interested_count ?? 0;
        if (oldStatus === 'attending') attendees = Math.max(0, attendees - 1);
        else interested = Math.max(0, interested - 1);
        return { ...ev, attendees_count: attendees, interested_count: interested };
      }),
    );
  }

  eventAttendeesCount(event: Event): number {
    return event.attendees_count ?? 0;
  }

  eventInterestedCount(event: Event): number {
    return event.interested_count ?? 0;
  }

  onStatusChange(value: 'upcoming' | 'past'): void {
    this.status.set(value);
    this.loadEvents(true);
  }

  onLanguageChange(value: string): void {
    this.languagePair.set(value ? value : undefined);
    this.loadEvents(true);
  }

  loadMore(): void {
    if (this.isLoading() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.loadEvents();
  }
}
