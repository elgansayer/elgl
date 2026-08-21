import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadio, HlmRadioGroup } from '@spartan-ng/helm/radio-group';
import { firstValueFrom } from 'rxjs';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSelectComponent } from '../primitives/select/select.component';
import { EventsService, type Event, type EventCategory } from '../../services/events.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-events-feed',
  imports: [
    HlmButton,
    HlmRadio,
    HlmRadioGroup,
    CommonModule,
    RouterLink,
    TranslatePipe,
    AppCardComponent,
    AppEmptyStateComponent,
    AppSelectComponent,
  ],
  template: `
    <main class="mx-auto w-full max-w-3xl p-4" aria-labelledby="events-feed-title">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 id="events-feed-title" class="text-2xl font-bold">{{ 'events.title' | t }}</h1>
        <a
          routerLink="/events/calendar"
          class="min-h-11 rounded-app px-3 py-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {{ 'events.calendar.title' | t }}
        </a>
      </div>

      <section class="mb-5 flex flex-wrap items-end gap-3" [attr.aria-label]="'events.title' | t">
        <hlm-radio-group
          name="events-status"
          [value]="status()"
          (valueChange)="onStatusChange($event)"
          [attr.aria-label]="'events.title' | t"
          class="flex flex-row gap-2"
        >
          <hlm-radio
            value="upcoming"
            class="min-h-11 cursor-pointer rounded-pill border border-surface-100 bg-surface-300 ps-4 pe-4 pt-2 pb-2 text-sm font-medium text-text-primary transition-colors data-[checked=true]:border-primary data-[checked=true]:bg-primary data-[checked=true]:text-on-fill"
          >
            {{ 'events.filter_upcoming' | t }}
          </hlm-radio>
          <hlm-radio
            value="past"
            class="min-h-11 cursor-pointer rounded-pill border border-surface-100 bg-surface-300 ps-4 pe-4 pt-2 pb-2 text-sm font-medium text-text-primary transition-colors data-[checked=true]:border-primary data-[checked=true]:bg-primary data-[checked=true]:text-on-fill"
          >
            {{ 'events.filter_past' | t }}
          </hlm-radio>
        </hlm-radio-group>

        <div class="min-w-48 grow sm:grow-0">
          <app-select
            selectId="events-language-pair"
            ariaLabel="events.languagePair"
            [value]="languagePair() ?? ''"
            (valueChange)="onLanguageChange($event)"
          >
            <option value="">{{ 'events.all_languages' | t }}</option>
            @for (option of languagePairOptions(); track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </app-select>
        </div>

        <div class="min-w-48 grow sm:grow-0">
          <app-select
            selectId="events-category"
            ariaLabel="events.category"
            [value]="category() ?? ''"
            (valueChange)="onCategoryChange($event)"
          >
            <option value="">{{ 'events.category' | t }}</option>
            @for (item of categories(); track item) {
              <option [value]="item">{{ categoryLabel(item) | t }}</option>
            }
          </app-select>
        </div>
      </section>

      @if (isLoading() && events().length === 0) {
        <p role="status" class="py-8 text-center text-text-secondary">{{ 'loading' | t }}</p>
      } @else if (error() && events().length === 0) {
        <div role="alert" class="flex flex-col items-start gap-3 rounded-card bg-surface-300 p-4">
          <p class="text-danger">{{ 'common.error_generic' | t }}</p>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (visibleEvents().length === 0) {
        <app-empty-state
          icon="📅"
          [description]="'events.calendar.noEvents' | t"
          [attr.aria-label]="'events.calendar.noEvents' | t"
        />
      } @else {
        <div class="space-y-3" role="list">
          @for (event of visibleEvents(); track event.id) {
            <app-card>
              <article class="p-4" role="listitem">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 grow">
                    <h2 class="text-lg font-semibold text-text-primary">
                      <a
                        [routerLink]="['/events', event.id]"
                        class="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {{ event.title }}
                      </a>
                    </h2>
                    <p class="mt-1 text-sm text-text-secondary">{{ formatDate(event.date_time) }}</p>
                  </div>
                  @if (event.category) {
                    <span class="rounded-pill bg-surface-100 px-2 py-1 text-xs text-text-secondary">
                      {{ categoryLabel(event.category) | t }}
                    </span>
                  }
                </div>

                @if (event.description) {
                  <p class="mt-3 line-clamp-2 text-sm text-text-secondary">{{ event.description }}</p>
                }
                <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                  @if (event.location) {
                    <span>{{ event.location }}</span>
                  }
                  @if (event.host_name) {
                    <span>{{ 'events.hosted_by' | t: { name: event.host_name } }}</span>
                  }
                </div>
                <a
                  [routerLink]="['/events', event.id]"
                  class="mt-3 inline-flex min-h-11 items-center rounded-app text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {{ 'events.calendar.viewDetails' | t }}
                </a>
              </article>
            </app-card>
          }
        </div>

        @if (error()) {
          <div role="alert" class="mt-4 flex flex-col items-start gap-3">
            <p class="text-danger">{{ 'common.error_generic' | t }}</p>
            <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
              {{ 'common.retry' | t }}
            </button>
          </div>
        }

        @if (hasMore()) {
          <button
            hlmBtn
            type="button"
            variant="secondary"
            size="touch"
            class="mt-4 w-full"
            [disabled]="isLoading()"
            [attr.aria-busy]="isLoading() ? 'true' : null"
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
    </main>
  `,
})
export class EventsFeedComponent implements OnInit {
  private readonly eventsService = inject(EventsService);
  private readonly i18nService = inject(I18nService);
  private readonly languagePairCodes = ['es', 'ja', 'ko', 'zh', 'fr', 'de', 'ar', 'pt', 'ru', 'it'];
  private requestSequence = 0;
  private latestRequestId = 0;

  readonly events = signal<Event[]>([]);
  readonly categories = signal<EventCategory[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal(false);
  readonly hasMore = signal(true);
  readonly status = signal<'upcoming' | 'past'>('upcoming');
  readonly languagePair = signal<string | undefined>(undefined);
  readonly category = signal<EventCategory | undefined>(undefined);
  private readonly page = signal(1);

  readonly visibleEvents = computed(() =>
    this.status() === 'upcoming'
      ? this.events().filter((event) => !event.is_cancelled)
      : this.events(),
  );

  readonly languagePairOptions = computed(() => {
    const locale = this.i18nService.currentLang();
    let displayNames: Intl.DisplayNames | undefined;
    try {
      displayNames = new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      displayNames = undefined;
    }

    const english = this.languageDisplayName('en', displayNames);
    return this.languagePairCodes.map((code) => ({
      value: `en-${code}`,
      label: `${english} ↔ ${this.languageDisplayName(code, displayNames)}`,
    }));
  });

  ngOnInit(): void {
    void this.loadCategories();
    void this.loadEvents(true);
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categories.set(await firstValueFrom(this.eventsService.getCategories()));
    } catch {
      this.categories.set([]);
    }
  }

  private languageDisplayName(code: string, displayNames: Intl.DisplayNames | undefined): string {
    const translated = displayNames?.of(code);
    if (translated) return translated;

    const knownLanguage = this.i18nService.availableLanguages.find(
      (language) => language.code === code || language.code.startsWith(`${code}-`),
    );
    return knownLanguage?.nativeName ?? code.toUpperCase();
  }

  formatDate(dateTime: string): string {
    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime())) return dateTime;
    return new Intl.DateTimeFormat(this.i18nService.currentLang(), {
      dateStyle: 'medium',
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

  private async loadEvents(reset = false): Promise<void> {
    const requestedPage = reset ? 1 : this.page() + 1;
    const requestId = ++this.requestSequence;
    this.latestRequestId = requestId;
    this.isLoading.set(true);
    this.error.set(false);

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
          category: this.category(),
          page: requestedPage,
          limit: PAGE_SIZE,
        }),
      );

      if (requestId !== this.latestRequestId) return;

      this.page.set(requestedPage);
      if (reset) {
        this.events.set(data);
      } else {
        this.events.update((previous) => [...previous, ...data]);
      }
      this.hasMore.set(data.length === PAGE_SIZE);
    } catch {
      if (requestId === this.latestRequestId) this.error.set(true);
    } finally {
      if (requestId === this.latestRequestId) this.isLoading.set(false);
    }
  }

  onStatusChange(value: unknown): void {
    if (value !== 'upcoming' && value !== 'past') return;
    if (value === this.status()) return;
    this.status.set(value);
    void this.loadEvents(true);
  }

  onLanguageChange(value: string): void {
    const next = value || undefined;
    if (next === this.languagePair()) return;
    this.languagePair.set(next);
    void this.loadEvents(true);
  }

  onCategoryChange(value: string): void {
    const next = value ? (value as EventCategory) : undefined;
    if (next === this.category()) return;
    if (next && !this.categories().includes(next)) return;
    this.category.set(next);
    void this.loadEvents(true);
  }

  retry(): void {
    if (this.isLoading()) return;
    void this.loadEvents(this.events().length === 0);
  }

  loadMore(): void {
    if (this.isLoading() || !this.hasMore()) return;
    void this.loadEvents();
  }
}
