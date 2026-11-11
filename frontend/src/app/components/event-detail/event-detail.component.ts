import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { firstValueFrom } from 'rxjs';
import { AppCardComponent } from '../primitives/card/card.component';
import { EventRsvpControlsComponent } from '../event-rsvp-controls/event-rsvp-controls.component';
import {
  EventsService,
  type Event,
  type EventCategory,
  type EventVenueType,
} from '../../services/events.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

const MAP_ZOOM_DELTA = 0.01;

@Component({
  selector: 'app-event-detail',
  imports: [
    RouterLink,
    HlmButton,
    AppCardComponent,
    TranslatePipe,
    EventRsvpControlsComponent,
  ],
  template: `
    <main class="mx-auto w-full max-w-2xl p-4" aria-labelledby="event-detail-title">
      @if (isLoading()) {
        <p role="status" class="py-8 text-center text-text-secondary">{{ 'loading' | t }}</p>
      } @else if (error()) {
        <div role="alert" class="flex flex-col items-start gap-3 rounded-card bg-surface-300 p-4">
          <p class="text-danger-ink">{{ 'common.error_generic' | t }}</p>
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

            @if (item.is_cancelled) {
              <p role="status" class="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink">
                {{ 'events.cancelled' | t }}
              </p>
            }

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
              @if (item.venue_type) {
                <div>
                  <dt class="text-xs font-semibold text-text-muted">{{ 'events.venueType' | t }}</dt>
                  <dd class="mt-1 text-sm text-text-primary">{{ venueLabel(item.venue_type) | t }}</dd>
                </div>
              }
              @if (item.timezone) {
                <div>
                  <dt class="text-xs font-semibold text-text-muted">{{ 'events.timezone' | t }}</dt>
                  <dd class="mt-1 text-sm text-text-primary">{{ item.timezone }}</dd>
                </div>
              }
              @if (ticketPrice(); as price) {
                <div>
                  <dt class="text-xs font-semibold text-text-muted">{{ 'events.ticketPrice' | t }}</dt>
                  <dd
                    class="mt-1 text-sm font-semibold text-text-primary"
                    [attr.aria-label]="ticketPriceAria()"
                  >
                    {{ price }}
                  </dd>
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

            @if (mapEmbed(); as mapUrl) {
              <section class="mt-5" [attr.aria-label]="'events.map' | t">
                <h2 class="mb-2 text-sm font-semibold text-text-primary">{{ 'events.map' | t }}</h2>
                <div class="overflow-hidden rounded-lg border border-surface-100">
                  <iframe
                    [src]="mapUrl"
                    [title]="'events.mapAlt' | t"
                    class="h-56 w-full border-0"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
                @if (mapHref(); as link) {
                  <a
                    [href]="link"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-2 inline-flex min-h-11 items-center rounded-app text-sm font-semibold text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {{ 'events.openMap' | t }}
                  </a>
                }
              </section>
            }

            <section class="mt-5 border-t border-surface-100 pt-4" [attr.aria-label]="'events.rsvp' | t">
              <h2 class="text-sm font-semibold text-text-primary">{{ 'events.rsvp' | t }}</h2>
              <app-event-rsvp-controls
                [eventId]="item.id"
                [eventTitle]="item.title"
                [maxParticipants]="item.max_participants"
                [mutable]="canRsvp(item)"
              />
            </section>

            @if (item.host_name) {
              <div class="mt-5 border-t border-surface-100 pt-4">
                <a
                  [routerLink]="['/profile', item.host_id]"
                  class="inline-flex min-h-11 items-center rounded-app text-sm font-semibold text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
  private readonly sanitizer = inject(DomSanitizer);

  readonly event = signal<Event | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal(false);

  readonly ticketPrice = computed(() => {
    const item = this.event();
    if (!item) return null;
    const prices: string[] = [];
    if (typeof item.ticket_price_gbp === 'number') {
      prices.push(this.formatCurrency(item.ticket_price_gbp, 'GBP'));
    }
    if (typeof item.ticket_price_usd === 'number') {
      prices.push(this.formatCurrency(item.ticket_price_usd, 'USD'));
    }
    return prices.length > 0 ? prices.join(' / ') : null;
  });

  readonly ticketPriceAria = computed(() => {
    const item = this.event();
    if (!item) return '';
    const prices: string[] = [];
    if (typeof item.ticket_price_gbp === 'number') {
      prices.push(
        `${this.i18n.translate('events.ticketGbp')}: ${this.formatCurrency(item.ticket_price_gbp, 'GBP')}`,
      );
    }
    if (typeof item.ticket_price_usd === 'number') {
      prices.push(
        `${this.i18n.translate('events.ticketUsd')}: ${this.formatCurrency(item.ticket_price_usd, 'USD')}`,
      );
    }
    return prices.join('. ');
  });

  readonly mapEmbed = computed<SafeResourceUrl | null>(() => {
    const item = this.event();
    const coordinates = item ? this.coordinates(item) : null;
    if (!coordinates) return null;
    const bbox = [
      coordinates.longitude - MAP_ZOOM_DELTA,
      coordinates.latitude - MAP_ZOOM_DELTA,
      coordinates.longitude + MAP_ZOOM_DELTA,
      coordinates.latitude + MAP_ZOOM_DELTA,
    ].join(',');
    const url =
      'https://www.openstreetmap.org/export/embed.html' +
      `?bbox=${encodeURIComponent(bbox)}&layer=mapnik` +
      `&marker=${coordinates.latitude}%2C${coordinates.longitude}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  readonly mapHref = computed(() => {
    const item = this.event();
    const coordinates = item ? this.coordinates(item) : null;
    if (!coordinates) return null;
    return (
      'https://www.openstreetmap.org/' +
      `?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}` +
      `#map=15/${coordinates.latitude}/${coordinates.longitude}`
    );
  });
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

  canRsvp(event: Event): boolean {
    return !event.is_cancelled && Date.parse(event.date_time) > Date.now();
  }

  venueLabel(venueType: EventVenueType): string {
    const labels: Record<EventVenueType, string> = {
      audio_room: 'events.venueAudio',
      zoom: 'events.venueZoom',
      in_person: 'events.venueInPerson',
    };
    return labels[venueType];
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

  private coordinates(
    event: Event,
  ): { latitude: number; longitude: number } | null {
    if (event.venue_type !== 'in_person') return null;
    const { latitude, longitude } = event;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }
    return { latitude, longitude };
  }

  private formatCurrency(amount: number, currency: 'GBP' | 'USD'): string {
    return new Intl.NumberFormat(this.i18n.currentLang(), {
      style: 'currency',
      currency,
    }).format(amount);
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
