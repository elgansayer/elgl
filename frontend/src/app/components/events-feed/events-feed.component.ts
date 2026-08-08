import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { EventsService, Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { CreateEventModalComponent } from '../../events/create-event-modal/create-event-modal.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-events-feed',
  standalone: true,
  imports: [CommonModule, TranslatePipe, DatePipe, CreateEventModalComponent],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">{{ 'events.title' | t }}</h1>
      <button
        class="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500"
        (click)="showCreateModal.set(true)"
      >
        {{ 'events.createTitle' | t }}
      </button>
    </div>

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

    <!-- Create Event Modal -->
    @if (showCreateModal()) {
      <app-create-event-modal
        (created)="onEventCreated($event)"
        (dismiss)="showCreateModal.set(false)"
      ></app-create-event-modal>
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
  readonly showCreateModal = signal(false);
  private page = signal(1);

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
    } catch {
      // keep current state on error
    } finally {
      this.isLoading.set(false);
    }
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

  onEventCreated(event: Event): void {
    this.events.update((prev) => [event, ...prev]);
    this.showCreateModal.set(false);
  }
}
