import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, computed, resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { showToast } from '../../services/toast.service';
import {
  LanguagePartyCreateModalComponent,
  LanguagePartyCreatePayload,
} from './language-party-create-modal.component';
import {
  LanguagePartySummary,
  parseJoinableLanguagePartyRoom,
  parseLanguagePartyList,
} from './language-party-contract';
import { environment } from '../../../environments/environment';

interface FilterOption {
  value: string;
  labelKey: string;
  flag1?: string;
  flag2?: string;
  emoji?: string;
}

const LANGUAGE_PAIR_OPTIONS: readonly FilterOption[] = [
  { value: 'en-es', labelKey: 'audioRoom.languagePair.en-es', flag1: '🇬🇧', flag2: '🇪🇸' },
  { value: 'en-fr', labelKey: 'audioRoom.languagePair.en-fr', flag1: '🇬🇧', flag2: '🇫🇷' },
  { value: 'en-ja', labelKey: 'audioRoom.languagePair.en-ja', flag1: '🇬🇧', flag2: '🇯🇵' },
  { value: 'ar-en', labelKey: 'audioRoom.languagePair.ar-en', flag1: '🇸🇦', flag2: '🇬🇧' },
  { value: 'en-ko', labelKey: 'audioRoom.languagePair.en-ko', flag1: '🇬🇧', flag2: '🇰🇷' },
  { value: 'en-zh', labelKey: 'audioRoom.languagePair.en-zh', flag1: '🇬🇧', flag2: '🇨🇳' },
  { value: 'en-pt', labelKey: 'audioRoom.languagePair.en-pt', flag1: '🇬🇧', flag2: '🇵🇹' },
  { value: 'en-ru', labelKey: 'audioRoom.languagePair.en-ru', flag1: '🇬🇧', flag2: '🇷🇺' },
  { value: 'en-de', labelKey: 'audioRoom.languagePair.en-de', flag1: '🇬🇧', flag2: '🇩🇪' },
  { value: 'en-it', labelKey: 'audioRoom.languagePair.en-it', flag1: '🇬🇧', flag2: '🇮🇹' },
  { value: 'en-hi', labelKey: 'audioRoom.languagePair.en-hi', flag1: '🇬🇧', flag2: '🇮🇳' },
  { value: 'en-tr', labelKey: 'audioRoom.languagePair.en-tr', flag1: '🇬🇧', flag2: '🇹🇷' },
];

const TOPIC_OPTIONS: readonly FilterOption[] = [
  { value: 'Free Talk', labelKey: 'languageParty.topic.FreeTalk', emoji: '💬' },
  { value: 'Beginners', labelKey: 'languageParty.topic.Beginners', emoji: '🌱' },
  { value: 'Pronunciation', labelKey: 'languageParty.topic.Pronunciation', emoji: '🗣️' },
  { value: 'Cultural Exchange', labelKey: 'languageParty.topic.CulturalExchange', emoji: '🌍' },
  { value: 'Grammar Help', labelKey: 'languageParty.topic.GrammarHelp', emoji: '📝' },
  { value: 'Business English', labelKey: 'languageParty.topic.BusinessEnglish', emoji: '💼' },
  { value: 'Travel Talk', labelKey: 'languageParty.topic.TravelTalk', emoji: '✈️' },
  { value: 'Music & Film', labelKey: 'languageParty.topic.MusicFilm', emoji: '🎬' },
  { value: 'Food & Cooking', labelKey: 'languageParty.topic.FoodCooking', emoji: '🍳' },
];

const LEVEL_OPTIONS: readonly FilterOption[] = [
  { value: 'beginner', labelKey: 'languageParty.level.beginner' },
  { value: 'intermediate', labelKey: 'languageParty.level.intermediate' },
  { value: 'advanced', labelKey: 'languageParty.level.advanced' },
  { value: 'all', labelKey: 'languageParty.level.all' },
];

@Component({
  standalone: true,
  imports: [
    HlmNativeSelect,
    HlmButton,
    RouterModule,
    FormsModule,
    TranslatePipe,
    LanguagePartyCreateModalComponent,
  ],
  template: `<div class="min-h-screen bg-surface-500 text-text-primary">
      <!-- Header + Create button -->
      <div
        class="px-4 pt-4 pb-2 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 class="text-2xl font-bold">{{ 'languageParty.title' | t }}</h1>
          <p class="text-sm text-text-secondary mt-1">{{ 'languageParty.subtitle' | t }}</p>
        </div>
        <button
          hlmBtn
          type="button"
          (click)="openCreateModal()"
          class="ms-auto flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-on-fill bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          <span class="text-lg">+</span>
          <span>{{ 'languageParty.createButton' | t }}</span>
        </button>
      </div>

      <!-- Filter pills -->
      <div class="px-4 sm:px-6 pb-3 overflow-x-auto">
        <div class="flex items-center gap-2 flex-nowrap">
          <div class="relative">
            <hlm-native-select
              [ngModel]="filterLanguagePair()"
              (ngModelChange)="filterLanguagePair.set($event)"
              class="appearance-none bg-surface-300 border border-surface-400 rounded-full px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer pe-8"
              selectClass="appearance-none bg-surface-300 border border-surface-400 rounded-full px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer pe-8"
            >
              <option value="">{{ 'languageParty.filterAllLanguages' | t }}</option>
              @for (opt of languagePairOptions; track opt.value) {
                <option [value]="opt.value">
                  {{ opt.flag1 }} {{ opt.flag2 }} {{ opt.labelKey | t }}
                </option>
              }
            </hlm-native-select>
          </div>

          <div class="relative">
            <hlm-native-select
              [ngModel]="filterTopic()"
              (ngModelChange)="filterTopic.set($event)"
              class="appearance-none bg-surface-300 border border-surface-400 rounded-full px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer pe-8"
              selectClass="appearance-none bg-surface-300 border border-surface-400 rounded-full px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer pe-8"
            >
              <option value="">{{ 'languageParty.filterAllTopics' | t }}</option>
              @for (opt of topicOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.emoji }} {{ opt.labelKey | t }}</option>
              }
            </hlm-native-select>
          </div>

          <div class="relative">
            <hlm-native-select
              [ngModel]="filterLevel()"
              (ngModelChange)="filterLevel.set($event)"
              class="appearance-none bg-surface-300 border border-surface-400 rounded-full px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer pe-8"
              selectClass="appearance-none bg-surface-300 border border-surface-400 rounded-full px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer pe-8"
            >
              <option value="">{{ 'languageParty.filterAllLevels' | t }}</option>
              @for (opt of levelOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.labelKey | t }}</option>
              }
            </hlm-native-select>
          </div>

          @if (activeFilterCount() > 0) {
            <button
              hlmBtn
              type="button"
              (click)="clearFilters()"
              class="flex items-center gap-1 px-3 py-2 rounded-full text-xs text-primary bg-primary/15 border border-primary/30 hover:bg-primary/25 transition-colors shrink-0"
            >
              <span>{{ 'languageParty.clearFilters' | t }} ({{ activeFilterCount() }})</span>
              <span>✕</span>
            </button>
          }

          <div class="flex-1"></div>

          <span class="text-xs text-text-muted whitespace-nowrap shrink-0">
            {{ 'languageParty.partyCount' | t: { count: parties().length } }}
          </span>
        </div>
      </div>

      <!-- Party grid -->
      <div class="px-4 sm:px-6 pb-8">
        @if (partiesResource.isLoading()) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            @for (i of [1, 2, 3, 4, 5, 6]; track i) {
              <div
                class="rounded-2xl bg-surface-300/60 border border-surface-400/60 p-5 animate-pulse"
              >
                <div class="h-5 bg-surface-400 rounded w-3/4 mb-3"></div>
                <div class="h-4 bg-surface-400 rounded w-1/2 mb-4"></div>
                <div class="flex gap-2 mb-3">
                  <div class="h-6 bg-surface-400 rounded-full w-20"></div>
                  <div class="h-6 bg-surface-400 rounded-full w-16"></div>
                </div>
                <div class="h-10 bg-surface-400 rounded-xl w-full mt-2"></div>
              </div>
            }
          </div>
        } @else if (partiesResource.error()) {
          <div class="app-empty-state" role="alert">
            <p class="text-lg font-bold text-text-primary">{{ 'common.error' | t }}</p>
            <button
              hlmBtn
              type="button"
              (click)="retryParties()"
              class="mt-4 min-h-11 rounded-app bg-primary px-5 py-2.5 font-bold text-on-fill"
            >
              {{ 'common.retry' | t }}
            </button>
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            @for (party of parties(); track party.id) {
              <article
                class="rounded-2xl bg-surface-300/60 border border-surface-400/60 hover:border-surface-500/80 p-5 flex flex-col transition-all hover:shadow-lg hover:shadow-primary/5 group"
              >
                <h3 class="text-lg font-bold mb-1 line-clamp-2" dir="auto">{{ party.title }}</h3>

                <div class="flex flex-wrap items-center gap-2 mb-3">
                  @if (party.language_pair) {
                    <span
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/25"
                    >
                      {{ 'audioRoom.languagePair.' + party.language_pair | t }}
                    </span>
                  }
                  @if (party.topic_tag) {
                    <span
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/15 text-secondary border border-secondary/25"
                      dir="auto"
                    >
                      #{{ party.topic_tag }}
                    </span>
                  }
                  @if (party.level) {
                    <span
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/15 text-warning border border-warning/25"
                    >
                      {{ 'languageParty.level.' + party.level | t }}
                    </span>
                  }
                </div>

                <div class="flex items-center gap-2 mb-4">
                  @if (party.host?.avatar_url) {
                    <img
                      loading="lazy"
                      [src]="party.host.avatar_url"
                      alt=""
                      referrerpolicy="no-referrer"
                      class="w-7 h-7 rounded-full object-cover border border-surface-500"
                    />
                  } @else {
                    <div
                      class="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-on-fill"
                      aria-hidden="true"
                    >
                      {{ party.host?.display_name?.slice(0, 1)?.toUpperCase() || 'H' }}
                    </div>
                  }
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate" dir="auto">
                      {{ party.host?.display_name || ('languageParty.unknownHost' | t) }}
                    </p>
                    <p class="text-xs text-text-muted">{{ 'languageParty.hostLabel' | t }}</p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-4 mb-4 text-xs text-text-secondary">
                  <span class="flex items-center gap-1">
                    <span aria-hidden="true">🎙️</span>
                    <span>{{
                      'languageParty.speakersCount' | t: { count: party.speakers.length }
                    }}</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <span aria-hidden="true">👥</span>
                    <span>{{
                      'languageParty.listenersCount' | t: { count: party.listeners_count }
                    }}</span>
                  </span>
                  @if (party.duration_minutes) {
                    <span class="flex items-center gap-1">
                      <span aria-hidden="true">⏱️</span>
                      <span>{{ party.duration_minutes }}min</span>
                    </span>
                  }
                </div>

                <div class="flex items-center gap-2 mt-auto">
                  <span class="relative flex h-2.5 w-2.5" aria-hidden="true">
                    <span
                      class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
                    ></span>
                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                  </span>
                  <span class="text-xs text-success font-medium">{{
                    'languageParty.liveNow' | t
                  }}</span>
                </div>

                <button
                  hlmBtn
                  type="button"
                  (click)="joinParty(party)"
                  [disabled]="joiningPartyId() !== null"
                  [attr.aria-busy]="joiningPartyId() === party.id"
                  class="mt-3 w-full min-h-11 py-2.5 rounded-xl font-bold text-on-fill bg-gradient-to-r from-success to-secondary hover:opacity-90 active:scale-[0.98] transition-all text-sm disabled:opacity-50"
                >
                  {{ 'languageParty.joinButton' | t }}
                </button>
              </article>
            } @empty {
              <div
                class="col-span-full flex flex-col items-center justify-center py-20 text-center"
              >
                <div
                  class="w-24 h-24 rounded-full bg-surface-300 flex items-center justify-center mb-6"
                  aria-hidden="true"
                >
                  <span class="text-4xl">🎙️</span>
                </div>
                @if (activeFilterCount() > 0) {
                  <h2 class="text-xl font-bold mb-2">
                    {{ 'languageParty.emptyFilteredTitle' | t }}
                  </h2>
                  <p class="text-text-secondary mb-4">
                    {{ 'languageParty.emptyFilteredSubtitle' | t }}
                  </p>
                  <button
                    hlmBtn
                    type="button"
                    (click)="clearFilters()"
                    class="px-5 py-2.5 rounded-xl font-bold text-on-fill bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                  >
                    {{ 'languageParty.clearFiltersAction' | t }}
                  </button>
                } @else {
                  <h2 class="text-xl font-bold mb-2">{{ 'languageParty.emptyTitle' | t }}</h2>
                  <p class="text-text-secondary mb-6">{{ 'languageParty.emptySubtitle' | t }}</p>
                  <button
                    hlmBtn
                    type="button"
                    (click)="openCreateModal()"
                    class="px-5 py-2.5 rounded-xl font-bold text-on-fill bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                  >
                    {{ 'languageParty.createFirstButton' | t }}
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>

    @if (showCreateModal()) {
      <app-language-party-create-modal
        [submitting]="creatingParty()"
        [submissionError]="createError()"
        (closed)="closeCreateModal()"
        (created)="onCreateParty($event)"
      />
    } `,
})
export class LanguagePartiesComponent {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private audioRoomsStore = inject(AudioRoomsStore);
  private pendingCreatedRoom: AudioRoomRecord | null = null;
  private pendingCreateFingerprint: string | null = null;

  readonly languagePairOptions = LANGUAGE_PAIR_OPTIONS;
  readonly topicOptions = TOPIC_OPTIONS;
  readonly levelOptions = LEVEL_OPTIONS;

  readonly filterLanguagePair = signal<string>('');
  readonly filterTopic = signal<string>('');
  readonly filterLevel = signal<string>('');
  readonly showCreateModal = signal<boolean>(false);
  readonly creatingParty = signal(false);
  readonly createError = signal<string | null>(null);
  readonly joiningPartyId = signal<string | null>(null);

  readonly partiesResource = resource<
    LanguagePartySummary[],
    { languagePair: string; topic: string; level: string }
  >({
    params: () => ({
      languagePair: this.filterLanguagePair(),
      topic: this.filterTopic(),
      level: this.filterLevel(),
    }),
    loader: async ({ params: filterParams }) => {
      const queryParams = new URLSearchParams();
      queryParams.set('type', 'language_party');
      if (filterParams.topic) queryParams.set('topic', filterParams.topic);
      if (filterParams.level) queryParams.set('level', filterParams.level);

      const response = await firstValueFrom(
        this.http.get<unknown>(`${environment.apiUrl}/audio-rooms/list?${queryParams.toString()}`),
      );
      const parties = parseLanguagePartyList(response);

      if (filterParams.languagePair) {
        return parties.filter((party) => party.language_pair === filterParams.languagePair);
      }
      return parties;
    },
  });

  readonly parties = computed(() =>
    this.partiesResource.hasValue() ? this.partiesResource.value() : [],
  );

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterLanguagePair()) count++;
    if (this.filterTopic()) count++;
    if (this.filterLevel()) count++;
    return count;
  });

  openCreateModal(): void {
    this.createError.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    if (this.creatingParty()) return;
    this.showCreateModal.set(false);
    this.createError.set(null);
    this.pendingCreatedRoom = null;
    this.pendingCreateFingerprint = null;
  }

  retryParties(): void {
    this.partiesResource.reload();
  }

  async onCreateParty(payload: LanguagePartyCreatePayload): Promise<void> {
    if (this.creatingParty()) return;

    const fingerprint = JSON.stringify(payload);
    this.creatingParty.set(true);
    this.createError.set(null);

    try {
      let room =
        this.pendingCreateFingerprint === fingerprint ? this.pendingCreatedRoom : null;

      if (!room) {
        const response = await firstValueFrom(
          this.http.post<unknown>(`${environment.apiUrl}/audio-rooms/language-parties`, {
            title: payload.title,
            language_pair: payload.languagePair,
            topic_tag: payload.topicTag,
            level: payload.level,
            is_video_stream: payload.isVideoStream,
          }),
        );
        room = parseJoinableLanguagePartyRoom(response);
        this.pendingCreatedRoom = room;
        this.pendingCreateFingerprint = fingerprint;
        this.partiesResource.reload();
      }

      await this.audioRoomsStore.joinRoom(room);
      this.pendingCreatedRoom = null;
      this.pendingCreateFingerprint = null;
      this.showCreateModal.set(false);
      showToast(this.i18n.translate('languageParty.createdToast'));
    } catch {
      const errorKey = this.pendingCreatedRoom
        ? 'languageParty.joinError'
        : 'languageParty.createError';
      const message = this.i18n.translate(errorKey);
      this.createError.set(message);
      showToast(message);
    } finally {
      this.creatingParty.set(false);
    }
  }

  async joinParty(party: Partial<LanguagePartySummary>): Promise<void> {
    if (!party.id || this.joiningPartyId() !== null) return;

    this.joiningPartyId.set(party.id);
    try {
      const response = await firstValueFrom(
        this.http.get<unknown>(`${environment.apiUrl}/audio-rooms/${party.id}`),
      );
      const room = parseJoinableLanguagePartyRoom(response, party.id);
      await this.audioRoomsStore.joinRoom(room);
    } catch {
      showToast(this.i18n.translate('languageParty.joinError'));
    } finally {
      this.joiningPartyId.set(null);
    }
  }

  clearFilters(): void {
    this.filterLanguagePair.set('');
    this.filterTopic.set('');
    this.filterLevel.set('');
  }
}
