import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { firstValueFrom } from 'rxjs';
import { Event, EventCategory, EventsService } from '../../services/events.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-event-detail',
  imports: [CommonModule, DatePipe, HlmButton, TranslatePipe],
  template: `
    <main class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6" aria-labelledby="event-detail-title">
      @if (isLoading()) {
        <p role="status">{{ 'loading' | t }}</p>
      } @else if (error()) {
        <div role="alert" class="flex flex-col items-start gap-3">
          <p class="text-danger">{{ 'common.error_generic' | t }}</p>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (event(); as item) {
        <article class="rounded-card border border-surface-100 bg-surface-200 p-5 shadow-card sm:p-6">
          <h1 id="event-detail-title" class="break-words text-2xl font-bold text-text-primary">
            {{ item.title }}
          </h1>
          <p class="mt-2 text-sm text-text-secondary">{{ item.date_time | date: 'full' }}</p>

          @if (item.host_name) {
            <p class="mt-2 text-sm">
              {{ 'events.hosted_by' | t: { name: item.host_name } }}
            </p>
          }

          @if (item.category) {
            <p class="mt-2 text-sm text-text-secondary">{{ categoryLabelKey(item.category) | t }}</p>
          }

          @if (item.location) {
            <p class="mt-3 break-words">{{ item.location }}</p>
          }

          @if (item.description) {
            <p class="mt-4 whitespace-pre-wrap break-words text-text-primary">{{ item.description }}</p>
          }

          <dl class="mt-5 grid gap-3 sm:grid-cols-2">
            @if (item.max_participants !== undefined && item.max_participants !== null) {
              <div>
                <dt class="text-xs text-text-secondary">{{ 'events.maxParticipants' | t }}</dt>
                <dd class="font-medium">{{ item.max_participants }}</dd>
              </div>
            }
            @if (item.attendees_count !== undefined && item.attendees_count !== null) {
              <div>
                <dt class="text-xs text-text-secondary">{{ 'events.calendar.attending' | t }}</dt>
                <dd class="font-medium">{{ item.attendees_count }}</dd>
              </div>
            }
            @if (item.interested_count !== undefined && item.interested_count !== null) {
              <div>
                <dt class="text-xs text-text-secondary">{{ 'events.calendar.interested' | t }}</dt>
                <dd class="font-medium">{{ item.interested_count }}</dd>
              </div>
            }
          </dl>
        </article>
      }
    </main>
  `,
})
export class EventDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly eventsService = inject(EventsService);

  readonly event = signal<Event | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal(false);
  private eventId = '';

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('eventId') ?? '';
    void this.loadEvent();
  }

  categoryLabelKey(category: EventCategory): string {
    switch (category) {
      case 'audio_room':
        return 'events.categoryAudioRoom';
      case 'learning_seminar':
        return 'events.categoryLearningSeminar';
      case 'in_person_meetup':
        return 'events.categoryInPersonMeetup';
      case 'cultural_exchange':
        return 'events.categoryCulturalExchange';
    }
  }

  retry(): void {
    if (this.isLoading()) return;
    void this.loadEvent();
  }

  private async loadEvent(): Promise<void> {
    if (!this.eventId) {
      this.error.set(true);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.error.set(false);
    try {
      this.event.set(await firstValueFrom(this.eventsService.getEvent(this.eventId)));
    } catch {
      this.event.set(null);
      this.error.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}
