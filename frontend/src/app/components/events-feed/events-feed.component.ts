import { Component, inject, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EventsService, Event } from '../../services/events.service';
import { CreateEventModalComponent } from '../../events/create-event-modal/create-event-modal.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { firstValueFrom } from 'rxjs';

type RsvpStatus = 'attending' | 'interested';

@Component({
  selector: 'app-events-feed',
  standalone: true,
  imports: [DatePipe, CreateEventModalComponent, TranslatePipe],
  template: `
    <div class="min-h-screen bg-[#121212] text-white">
      <div class="px-4 pt-6 pb-4">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-extrabold tracking-tight">{{ 'events.title' | t }}</h1>
          <button
            (click)="showCreateModal.set(true)"
            class="px-4 py-2 rounded-full bg-accent-500 hover:bg-accent-400 text-white text-sm font-bold transition-colors"
          >
            + {{ 'events.createEvent' | t }}
          </button>
        </div>

        <!-- Status Pills -->
        <div class="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
          @for (pill of statusPills(); track pill.id) {
            <button
              (click)="onStatusChange(pill.id)"
              class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200"
              [class.bg-purple-600]="status() === pill.id"
              [class.text-white]="status() === pill.id"
              [class.bg-surface-300]="status() !== pill.id"
              [class.text-text-secondary]="status() !== pill.id"
              [class.border]="status() !== pill.id"
              [class.border-surface-200]="status() !== pill.id"
            >{{ pill.label }}</button>
          }
        </div>

        <!-- Category Pills -->
        <div class="flex gap-2 mb-4 overflow-x-auto hide-scrollbar">
          <button
            (click)="onCategoryChange('')"
            class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200"
            [class.bg-accent-500]="selectedCategory() === ''"
            [class.text-white]="selectedCategory() === ''"
            [class.bg-surface-300]="selectedCategory() !== ''"
            [class.text-text-secondary]="selectedCategory() !== ''"
            [class.border]="selectedCategory() !== ''"
            [class.border-surface-200]="selectedCategory() !== ''"
          >{{ 'events.all_categories' | t }}</button>
          @for (cat of categoryPills(); track cat.id) {
            <button
              (click)="onCategoryChange(cat.id)"
              class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200"
              [class.bg-accent-500]="selectedCategory() === cat.id"
              [class.text-white]="selectedCategory() === cat.id"
              [class.bg-surface-300]="selectedCategory() !== cat.id"
              [class.text-text-secondary]="selectedCategory() !== cat.id"
              [class.border]="selectedCategory() !== cat.id"
              [class.border-surface-200]="selectedCategory() !== cat.id"
            >{{ cat.label }}</button>
          }
        </div>

        <!-- Language Pair Selector -->
        <div class="mb-4">
          <select
            [value]="languagePair() ?? ''"
            (change)="onLanguageChange($any($event.target).value)"
            class="bg-surface-400 border border-surface-200 rounded-lg px-3 py-2 text-sm text-text-primary w-full max-w-xs"
          >
            <option value="">{{ 'events.all_languages' | t }}</option>
            <option value="en-es">English ↔ Español</option>
            <option value="en-ja">English ↔ 日本語</option>
            <option value="en-ko">English ↔ 한국어</option>
            <option value="en-zh">English ↔ 中文</option>
            <option value="en-fr">English ↔ Français</option>
            <option value="en-de">English ↔ Deutsch</option>
            <option value="en-ar">English ↔ العربية</option>
            <option value="en-pt">English ↔ Português</option>
            <option value="en-ru">English ↔ Русский</option>
            <option value="en-it">English ↔ Italiano</option>
          </select>
        </div>
      </div>

      <!-- Event Cards -->
      <div class="px-4 pb-24">
        @if (isLoading() && events().length === 0) {
          <div class="space-y-3">
            @for (_ of [1, 2, 3]; track $index) {
              <div class="p-4 bg-surface-400 rounded-xl animate-pulse">
                <div class="h-5 bg-surface-300 rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-surface-300 rounded w-1/2 mb-2"></div>
                <div class="h-3 bg-surface-300 rounded w-1/3"></div>
              </div>
            }
          </div>
        } @else if (events().length === 0) {
          <div class="text-center py-12">
            <div class="text-4xl mb-3" aria-hidden="true">📅</div>
            <p class="text-text-secondary text-lg font-semibold mb-1">{{ 'events.empty_title' | t }}</p>
            <p class="text-text-muted text-sm mb-4">{{ 'events.empty_subtitle' | t }}</p>
            <button
              (click)="showCreateModal.set(true)"
              class="px-6 py-2 rounded-full bg-accent-500 hover:bg-accent-400 text-white text-sm font-bold transition-colors"
            >{{ 'events.create_first' | t }}</button>
          </div>
        } @else {
          <div class="space-y-3">
            @for (ev of events(); track ev.id) {
              <div
                class="p-4 bg-surface-400 rounded-xl border border-surface-200 hover:border-accent-500/30 transition-all cursor-pointer"
              >
                <!-- Header Row: Category badge + Date -->
                <div class="flex items-center justify-between mb-2">
                  <span
                    class="text-xs font-semibold px-2 py-0.5 rounded-full"
                    [class.bg-purple-600/30]="ev.category === 'audio_room'"
                    [class.text-purple-300]="ev.category === 'audio_room'"
                    [class.bg-blue-600/30]="ev.category === 'learning_seminar'"
                    [class.text-blue-300]="ev.category === 'learning_seminar'"
                    [class.bg-green-600/30]="ev.category === 'in_person_meetup'"
                    [class.text-green-300]="ev.category === 'in_person_meetup'"
                    [class.bg-orange-600/30]="ev.category === 'cultural_exchange'"
                    [class.text-orange-300]="ev.category === 'cultural_exchange'"
                    [class.bg-gray-600/30]="!ev.category || !['audio_room','learning_seminar','in_person_meetup','cultural_exchange'].includes(ev.category)"
                    [class.text-gray-300]="!ev.category || !['audio_room','learning_seminar','in_person_meetup','cultural_exchange'].includes(ev.category)"
                  >{{ categoryLabel(ev.category) }}</span>
                  <span class="text-xs text-text-muted">{{ ev.date_time | date:'medium' }}</span>
                </div>

                <!-- Title -->
                <h3 class="font-bold text-base text-text-primary mb-1">{{ ev.title }}</h3>

                <!-- Language Pair & Proficiency -->
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                  @if (ev.language_pair) {
                    <span class="text-xs text-text-secondary bg-surface-300 px-2 py-0.5 rounded">
                      {{ ev.language_pair }}
                    </span>
                  }
                  @if (ev.proficiency) {
                    <span class="text-xs text-text-secondary bg-surface-300 px-2 py-0.5 rounded">
                      {{ ev.proficiency }}
                    </span>
                  }
                </div>

                <!-- Host Info -->
                @if (ev.host_name) {
                  <div class="flex items-center gap-2 mb-2">
                    @if (ev.host_avatar_url) {
                      <img
                        [src]="ev.host_avatar_url"
                        alt=""
                        class="w-6 h-6 rounded-full object-cover"
                      />
                    } @else {
                      <span class="w-6 h-6 rounded-full bg-surface-300 flex items-center justify-center text-xs font-bold text-text-muted">
                        {{ ev.host_name.charAt(0).toUpperCase() }}
                      </span>
                    }
                    <span class="text-xs text-text-secondary">
                      {{ 'events.hosted_by' | t : { name: ev.host_name } }}
                    </span>
                  </div>
                }

                <!-- Footer: Attendees + RSVP actions -->
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-surface-200">
                  <div class="flex items-center gap-3 text-xs text-text-muted">
                    @if ((ev.attendees_count ?? 0) > 0) {
                      <span class="flex items-center gap-1">
                        <span aria-hidden="true">👥</span>
                        {{ ev.attendees_count }} {{ 'events.attending' | t }}
                      </span>
                    }
                    @if ((ev.interested_count ?? 0) > 0) {
                      <span class="flex items-center gap-1">
                        <span aria-hidden="true">⭐</span>
                        {{ ev.interested_count }} {{ 'events.interested' | t }}
                      </span>
                    }
                  </div>
                  <div class="flex gap-2">
                    <button
                      (click)="handleRsvp($event, ev, 'interested')"
                      class="px-3 py-1 rounded-full text-xs font-semibold transition-colors bg-surface-300 hover:bg-surface-200 text-text-secondary border border-surface-200"
                      [class.bg-accent-500/20]="ev.my_rsvp === 'interested'"
                      [class.text-accent-400]="ev.my_rsvp === 'interested'"
                      [class.border-accent-500]="ev.my_rsvp === 'interested'"
                    >{{ 'events.interested_btn' | t }}</button>
                    <button
                      (click)="handleRsvp($event, ev, 'attending')"
                      class="px-3 py-1 rounded-full text-xs font-semibold transition-colors bg-surface-300 hover:bg-surface-200 text-text-secondary border border-surface-200"
                      [class.bg-green-500/20]="ev.my_rsvp === 'attending'"
                      [class.text-green-400]="ev.my_rsvp === 'attending'"
                      [class.border-green-500]="ev.my_rsvp === 'attending'"
                    >{{ 'events.rsvp_attending' | t }}</button>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Load More -->
          @if (hasMore()) {
            <button
              class="mt-4 w-full py-3 bg-surface-400 border border-surface-200 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-300 disabled:opacity-50 transition-colors"
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
      </div>

      <!-- Create Event Modal -->
      @if (showCreateModal()) {
        <app-create-event-modal
          (created)="onEventCreated($event)"
          (dismiss)="showCreateModal.set(false)"
        ></app-create-event-modal>
      }
    </div>
  `,
  styles: [
    `
      .hide-scrollbar::-webkit-scrollbar { display: none; }
      .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `,
  ],
})
export class EventsFeedComponent {
  private eventsService = inject(EventsService);
  private i18n = inject(I18nService);

  readonly events = signal<Event[]>([]);
  readonly isLoading = signal(false);
  readonly hasMore = signal(true);
  readonly status = signal<'upcoming' | 'past'>('upcoming');
  readonly languagePair = signal<string | undefined>(undefined);
  readonly selectedCategory = signal('');
  readonly showCreateModal = signal(false);
  private page = signal(1);

  readonly statusPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'upcoming', label: this.i18n.translate('events.filter_upcoming') },
      { id: 'past', label: this.i18n.translate('events.filter_past') },
    ];
  });

  readonly categoryPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'audio_room', label: this.i18n.translate('events.cat_audio_room') },
      { id: 'learning_seminar', label: this.i18n.translate('events.cat_learning_seminar') },
      { id: 'in_person_meetup', label: this.i18n.translate('events.cat_in_person_meetup') },
      { id: 'cultural_exchange', label: this.i18n.translate('events.cat_cultural_exchange') },
    ];
  });

  constructor() {
    void this.loadEvents(true);
  }

  private async loadEvents(reset = false): Promise<void> {
    this.isLoading.set(true);
    if (reset) {
      this.page.set(1);
      this.events.set([]);
      this.hasMore.set(true);
    }
    try {
      const cat = this.selectedCategory()
        ? (this.selectedCategory() as 'audio_room' | 'learning_seminar' | 'in_person_meetup' | 'cultural_exchange')
        : undefined;
      const data = await firstValueFrom(
        this.eventsService.listEvents({
          status: this.status(),
          language_pair: this.languagePair() || undefined,
          category: cat,
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

  onStatusChange(value: string): void {
    this.status.set(value as 'upcoming' | 'past');
    void this.loadEvents(true);
  }

  onLanguageChange(value: string): void {
    this.languagePair.set(value || undefined);
    void this.loadEvents(true);
  }

  onCategoryChange(value: string): void {
    this.selectedCategory.set(value);
    void this.loadEvents(true);
  }

  loadMore(): void {
    if (this.isLoading() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    void this.loadEvents();
  }

  onEventCreated(_ev: Event): void {
    this.showCreateModal.set(false);
    void this.loadEvents(true);
  }

  categoryLabel(cat: string | undefined): string {
    if (!cat) return this.i18n.translate('events.cat_general');
    const key = `events.cat_${cat}`;
    return this.i18n.translate(key);
  }

  async handleRsvp(domEvent: MouseEvent, detail: Event, rsvpStatus: RsvpStatus): Promise<void> {
    domEvent.stopPropagation();
    try {
      await firstValueFrom(this.eventsService.rsvpToEvent(detail.id, rsvpStatus));
      this.events.update((evs) =>
        evs.map((e) => {
          if (e.id === detail.id) {
            const updated = { ...e, my_rsvp: rsvpStatus };
            if (rsvpStatus === 'attending') {
              updated.attendees_count = (updated.attendees_count ?? 0) + 1;
            } else {
              updated.interested_count = (updated.interested_count ?? 0) + 1;
            }
            return updated;
          }
          return e;
        }),
      );
    } catch {
      // silent
    }
  }
}
