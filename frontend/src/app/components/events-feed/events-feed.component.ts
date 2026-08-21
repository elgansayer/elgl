import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadio, HlmRadioGroup } from '@spartan-ng/helm/radio-group';
import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppSelectComponent } from '../primitives/select/select.component';
import { EventsService, Event } from '../../services/events.service';
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
  ],
  template: `
    <h1 class="text-2xl font-bold mb-4">{{ 'events.title' | t }}</h1>

    <!-- Filter bar -->
    <div class="flex gap-2 mb-4 items-center flex-wrap">
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
    </div>

    <!-- Event list -->
    @if (isLoading() && events().length === 0) {
      <p role="status">{{ 'loading' | t }}</p>
    } @else if (error() && events().length === 0) {
      <div role="alert" class="flex flex-col items-start gap-3">
        <p class="text-danger">{{ 'common.error_generic' | t }}</p>
        <button hlmBtn type="button" variant="secondary" size="touch" (click)="retry()">
          {{ 'common.retry' | t }}
        </button>
      </div>
    } @else {
      <div class="space-y-3">
        @for (event of events(); track event.id) {
          <div class="p-4 bg-surface-300 rounded-lg shadow">
            <h2 class="font-semibold text-lg">{{ event.title }}</h2>
            <p class="text-sm text-text-secondary">
              {{ event.date_time | date: 'medium' }}
            </p>
            @if (event.location) {
              <p class="text-xs">{{ event.location }}</p>
            }
            @if (event.host_name) {
              <p class="text-xs">
                {{ 'events.hosted_by' | t: { name: event.host_name } }}
              </p>
            }
          </div>
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
  `,
})
export class EventsFeedComponent implements OnInit {
  private readonly eventsService = inject(EventsService);
  private readonly i18nService = inject(I18nService);
  private readonly languagePairCodes = ['es', 'ja', 'ko', 'zh', 'fr', 'de', 'ar', 'pt', 'ru', 'it'];
  private requestSequence = 0;
  private latestRequestId = 0;

  readonly events = signal<Event[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal(false);
  readonly hasMore = signal(true);
  readonly status = signal<'upcoming' | 'past'>('upcoming');
  readonly languagePair = signal<string | undefined>(undefined);
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
    void this.loadEvents(true);
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

  retry(): void {
    if (this.isLoading()) return;
    void this.loadEvents(this.events().length === 0);
  }

  loadMore(): void {
    if (this.isLoading() || !this.hasMore()) return;
    void this.loadEvents();
  }
}
