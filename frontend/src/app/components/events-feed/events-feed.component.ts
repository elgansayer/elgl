import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadio, HlmRadioGroup } from '@spartan-ng/helm/radio-group';
import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppSelectComponent } from '../primitives/select/select.component';
import {
  Event,
  EventCategory,
  EventsService,
  EVENT_CATEGORIES,
} from '../../services/events.service';
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
    TranslatePipe,
    DatePipe,
    AppSelectComponent,
    RouterLink,
  ],
  template: `
    <main class="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6" aria-labelledby="events-feed-title">
      <h1 id="events-feed-title" class="mb-4 text-2xl font-bold">{{ 'events.title' | t }}</h1>

      <div class="mb-4 flex flex-wrap items-center gap-2" aria-label="{{ 'events.title' | t }}">
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
            @for (option of categories(); track option) {
              <option [value]="option">{{ categoryLabelKey(option) | t }}</option>
            }
          </app-select>
        </div>
      </div>

      @if (isLoading() && events().length === 0) {
        <p role="status">{{ 'loading' | t }}</p>
      } @else if (error() && events().length === 0) {
        <div role="alert" class="flex flex-col items-start gap-3">
          <p class="text-danger">{{ 'common.error_generic' | t }}</p>
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (events().length === 0) {
        <p role="status" class="rounded-card bg-surface-200 p-4 text-text-secondary">
          {{ 'events.calendar.noEvents' | t }}
        </p>
      } @else {
        <div class="space-y-3" aria-live="polite">
          @for (event of events(); track event.id) {
            <article class="rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card">
              <h2 class="text-lg font-semibold">
                <a
                  [routerLink]="['/events', event.id]"
                  class="rounded-sm text-text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  {{ event.title }}
                </a>
              </h2>
              <p class="text-sm text-text-secondary">
                {{ event.date_time | date: 'medium' }}
              </p>
              @if (event.category) {
                <p class="text-xs text-text-secondary">{{ categoryLabelKey(event.category) | t }}</p>
              }
              @if (event.location) {
                <p class="break-words text-xs">{{ event.location }}</p>
              }
              @if (event.host_name) {
                <p class="text-xs">
                  {{ 'events.hosted_by' | t: { name: event.host_name } }}
                </p>
              }
            </article>
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

  private async loadCategories(): Promise<void> {
    try {
      const categories = await firstValueFrom(this.eventsService.getCategories());
      this.categories.set(categories.filter((category) => EVENT_CATEGORIES.includes(category)));
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
      if (requestId === this.latestRequestId) {
        this.error.set(true);
      }
    } finally {
      if (requestId === this.latestRequestId) {
        this.isLoading.set(false);
      }
    }
  }

  onStatusChange(value: unknown): void {
    if (value !== 'upcoming' && value !== 'past') return;
    if (value === this.status()) return;

    this.status.set(value);
    void this.loadEvents(true);
  }

  onLanguageChange(value: string): void {
    const nextLanguagePair = value || undefined;
    if (nextLanguagePair === this.languagePair()) return;

    this.languagePair.set(nextLanguagePair);
    void this.loadEvents(true);
  }

  onCategoryChange(value: string): void {
    const nextCategory = EVENT_CATEGORIES.find((category) => category === value);
    if (nextCategory === this.category()) return;

    this.category.set(nextCategory);
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
