import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { EventsService, Event } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { CreateEventModalComponent } from '../../events/create-event-modal/create-event-modal.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-events-feed',
  imports: [CommonModule, TranslatePipe, DatePipe, CreateEventModalComponent],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-white">{{ 'events.title' | t }}</h1>
      <button
        class="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 transition-colors"
        (click)="showCreateModal.set(true)"
      >
        {{ 'events.createEvent' | t }}
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
        (change)="onLanguageSelectChange($event)"
        class="bg-surface-200 border border-surface-100 rounded px-2 py-1 text-sm text-white"
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
      <p class="text-text-secondary">{{ 'loading' | t }}</p>
    } @else {
      <div class="space-y-3">
        @for (event of events(); track event.id) {
          <div class="p-4 bg-surface-400 rounded-lg shadow">
            <h2 class="font-semibold text-lg text-white">{{ event.title }}</h2>
            <p class="text-sm text-text-secondary">
              {{ event.date_time | date:'medium' }}
            </p>
            @if (event.location) {
              <p class="text-xs text-text-muted">{{ event.location }}</p>
            }
            @if (event.host_name) {
              <p class="text-xs text-text-secondary">
                {{ 'events.hosted_by' | t : { name: event.host_name } }}
              </p>
            }
          </div>
        }
      </div>
      @if (hasMore()) {
        <button
          class="mt-4 w-full py-2 bg-surface-200 border border-surface-100 rounded text-sm font-medium text-white disabled:opacity-50"
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
        (dismiss)="showCreateModal.set(false)"
        (created)="onEventCreated($event)"
      />
    }
  `,
})
export class EventsFeedComponent {
  private eventsService = inject(EventsService);

  readonly events = signal<Event[]>([]);
  readonly isLoading = signal(false);
  readonly hasMore = signal(true);
  readonly status = signal<'upcoming' | 'past'>('upcoming');
  readonly languagePair = signal<string | undefined>(undefined);
  readonly showCreateModal = signal(false);
  private page = signal(1);

  constructor() {
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

  onEventCreated(event: Event): void {
    this.showCreateModal.set(false);
    this.events.update((prev) => [event, ...prev]);
  }

  onStatusChange(value: 'upcoming' | 'past'): void {
    this.status.set(value);
    this.loadEvents(true);
  }

  onLanguageSelectChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      const value = target.value;
      this.languagePair.set(value ? value : undefined);
      this.loadEvents(true);
    }
  }

  loadMore(): void {
    if (this.isLoading() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.loadEvents();
  }
}
