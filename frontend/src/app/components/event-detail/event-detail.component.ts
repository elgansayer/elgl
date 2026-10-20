import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { firstValueFrom } from 'rxjs';
import { AppCardComponent } from '../primitives/card/card.component';
import { EventsService, type Event, type EventCategory } from '../../services/events.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-event-detail',
  imports: [RouterLink, HlmButton, AppCardComponent, TranslatePipe],
  template: `
    <main class="mx-auto w-full max-w-2xl p-4" aria-labelledby="event-detail-title">
      @if (isLoading()) {
        <p role="status" class="py-8 text-center text-text-secondary">{{ 'loading' | t }}</p>
      } @else if (error()) {
        <div role="alert" class="flex flex-col items-start gap-3 rounded-card bg-surface-300 p-4">
          <p class="text-danger">{{ 'common.error_generic' | t }}</p>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (event(); as item) {
        <app-card>
          <article class="p-5">
            <header class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 grow">
                <h1 id="event-detail-title" class="text-2xl font-bold text-text-primary">
                  {{ item.title }}
                </h1>
                <p class="mt-2 text-sm text-text-secondary">{{ formatDate(item.date_time) }}</p>
              </div>
              @if (item.category) {
                <span class="rounded-pill bg-surface-100 px-2 py-1 text-xs text-text-secondary">
                  {{ categoryLabel(item.category) | t }}
                </span>
              }
            </header>

            @if (item.description) {
              <section class="mt-5" [attr.aria-label]="'events.description' | t">
                <p class="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                  {{ item.description }}
                </p>
              </section>
            }

            <dl class="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-xs font-semibold text-text-muted">{{ 'events.datetime' | t }}</dt>
                <dd class="mt-1 text-sm text-text-primary">{{ formatDate(item.date_time) }}</dd>
              </div>
              @if (item.location) {
                <div>
                  <dt class="text-xs font-semibold text-text-muted">{{ 'events.location' | t }}</dt>
                  <dd class="mt-1 text-sm text-text-primary">{{ item.location }}</dd>
                </div>
              }
              @if (item.language_pair) {
                <div>
                  <dt class="text-xs font-semibold text-text-muted">{{ 'events.languagePair' | t }}</dt>
                  <dd class="mt-1 text-sm text-text-primary">{{ item.language_pair }}</dd>
                </div>
              }
              @if (item.attendees_count !== undefined) {
                <div>
                  <dt class="text-xs font-semibold text-text-muted">
                    {{ 'events.calendar.attending' | t }}
                  </dt>
                  <dd class="mt-1 text-sm text-text-primary">{{ item.attendees_count }}</dd>
                </div>
              }
              @if (item.interested_count !== undefined) {
                <div>
                  <dt class="text-xs font-semibold text-text-muted">
                    {{ 'events.calendar.interested' | t }}
                  </dt>
                  <dd class="mt-1 text-sm text-text-primary">{{ item.interested_count }}</dd>
                </div>
              }
            </dl>

            @if (item.host_name) {
              <div class="mt-5 border-t border-surface-100 pt-4">
                <a
                  [routerLink]="['/profile', item.host_id]"
                  class="inline-flex min-h-11 items-center rounded-app text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {{ 'events.hosted_by' | t: { name: item.host_name } }}
                </a>
              </div>
            }
          </article>
        </app-card>
      }
    </main>
  `,
})
export class EventDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly eventsService = inject(EventsService);
  private readonly i18n = inject(I18nService);

  readonly event = signal<Event | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal(false);
  private eventId = '';
  private requestId = 0;

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.load();
  }

  retry(): void {
    if (!this.isLoading()) void this.load();
  }

  formatDate(dateTime: string): string {
    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime())) return dateTime;
    return new Intl.DateTimeFormat(this.i18n.currentLang(), {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(parsed);
  }

  categoryLabel(category: EventCategory): string {
    const labels: Record<EventCategory, string> = {
      audio_room: 'events.categoryAudioRoom',
      learning_seminar: 'events.categoryLearningSeminar',
      in_person_meetup: 'events.categoryInPersonMeetup',
      cultural_exchange: 'events.categoryCulturalExchange',
    };
    return labels[category];
  }

  private async load(): Promise<void> {
    const currentRequest = ++this.requestId;
    this.isLoading.set(true);
    this.error.set(false);
    try {
      if (!this.eventId) throw new Error('Missing event id');
      const item = await firstValueFrom(this.eventsService.getEvent(this.eventId));
      if (currentRequest === this.requestId) this.event.set(item);
    } catch {
      if (currentRequest === this.requestId) {
        this.event.set(null);
        this.error.set(true);
      }
    } finally {
      if (currentRequest === this.requestId) this.isLoading.set(false);
    }
  }
}
