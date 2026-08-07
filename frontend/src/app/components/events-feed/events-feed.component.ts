import {Component, inject, OnInit, signal} from '@angular/core';import { CommonModule, DatePipe } from '@angular/common';
import { EventsService, Event } from '../../services/events.service';
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
        <option value="en-es">{{ 'components.events-feed.englishSpanish' | t }}</option>
        <option value="en-ja">{{ 'components.events-feed.englishJapanese' | t }}</option>
        <option value="en-ko">{{ 'components.events-feed.englishKorean' | t }}</option>
        <option value="en-zh">{{ 'components.events-feed.englishChinese' | t }}</option>
        <option value="en-fr">{{ 'components.events-feed.englishFrench' | t }}</option>
        <option value="en-de">{{ 'components.events-feed.englishGerman' | t }}</option>
        <option value="en-ar">{{ 'components.events-feed.englishArabic' | t }}</option>
        <option value="en-pt">{{ 'components.events-feed.englishPortuguese' | t }}</option>
        <option value="en-ru">{{ 'components.events-feed.englishRussian' | t }}</option>
        <option value="en-it">{{ 'components.events-feed.englishItalian' | t }}</option>
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
}
