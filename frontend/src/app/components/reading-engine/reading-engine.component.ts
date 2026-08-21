import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { VocabularyDashboardComponent } from '../vocabulary-dashboard/vocabulary-dashboard.component';

import { I18nService } from '../../services/i18n.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { NetworkStatusService } from '../../services/network-status.service';
import { OfflineReadingService } from '../../services/offline-reading.service';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppChipComponent } from '../primitives/chip/chip.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

interface ReadingArticle {
  id: string;
  title: string;
  content: string;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topic: string;
  audioUrl?: string;
  wordCount: number;
}

interface ReadingHistoryEntry {
  articleId: string;
  title: string;
  difficulty: string;
  topic: string;
  readAt: number;
}

const TAB_IDS = ['articles', 'vocabulary', 'history'] as const;
type TabId = (typeof TAB_IDS)[number];

@Component({
  selector: 'app-reading-engine',
  standalone: true,
  imports: [
    HlmButton,
    TranslatePipe,
    AppEmptyStateComponent,
    AppSkeletonLoaderComponent,
    AppCardComponent,
    AppChipComponent,
    AppButtonSecondaryComponent,
    VocabularyDashboardComponent,
  ],
  template: `<div
    class="reading-engine mx-auto max-w-4xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 pb-16 sm:pb-20 pt-4"
  >
    <!-- Header & Tab Navigation -->
    <app-card customClass="app-padded space-y-3 sm:space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="app-section-title text-base sm:text-lg">{{ 'readingEngine.title' | t }}</h1>
          <p class="app-muted text-xs sm:text-sm">{{ 'readingEngine.subtitle' | t }}</p>
        </div>
        <app-chip
          customClass="bg-primary/20 text-primary font-bold text-[10px] sm:text-xs px-2 sm:px-3 py-1"
        >
          {{ 'readingEngine.vocabularyCount' | t: { count: vocabularyCount() } }}
        </app-chip>
      </div>

      <nav
        class="flex gap-1 sm:gap-2 overflow-x-auto border-b border-surface-100 pb-2 -mx-1 px-1"
        role="tablist"
        [attr.aria-label]="'readingEngine.tabNavAriaLabel' | t"
      >
        @for (tabId of tabIds; track tabId) {
          <button
            hlmBtn
            type="button"
            role="tab"
            [id]="'reading-tab-' + tabId"
            [attr.aria-selected]="activeTab() === tabId"
            [attr.aria-controls]="'reading-panel-' + tabId"
            [attr.tabindex]="activeTab() === tabId ? 0 : -1"
            (click)="setTab(tabId)"
            (keydown)="onTabKeydown($event, tabId)"
            [class.bg-primary]="activeTab() === tabId"
            [class.text-on-fill]="activeTab() === tabId"
            [class.bg-surface-300]="activeTab() !== tabId"
            [class.text-text-secondary]="activeTab() !== tabId"
            class="rounded-app px-3 sm:px-4 py-2.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap flex-shrink-0 min-h-[44px] sm:min-h-0"
          >
            {{ 'readingEngine.tab.' + tabId | t }}
          </button>
        }
      </nav>
    </app-card>

    @if (activeTab() === 'articles') {
      <section
        role="tabpanel"
        id="reading-panel-articles"
        [attr.aria-labelledby]="'reading-tab-articles'"
        [attr.aria-hidden]="activeTab() !== 'articles'"
      >
        @if (selectedArticle(); as article) {
          <div class="space-y-4">
            <app-button-secondary
              (clicked)="backToList()"
              [ariaLabel]="'readingEngine.backToList' | t"
              customClass="text-xs font-bold flex items-center gap-1.5"
            >
              <span aria-hidden="true">&larr;</span>
              {{ 'readingEngine.backToList' | t }}
            </app-button-secondary>

            <app-card customClass="app-padded space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  [class.bg-success/20]="article.difficulty === 'beginner'"
                  [class.text-success]="article.difficulty === 'beginner'"
                  [class.bg-warning/20]="article.difficulty === 'intermediate'"
                  [class.text-warning]="article.difficulty === 'intermediate'"
                  [class.bg-danger/20]="article.difficulty === 'advanced'"
                  [class.text-danger]="article.difficulty === 'advanced'"
                  class="rounded-app px-2 py-0.5 text-[11px] font-bold"
                >
                  {{ 'readingEngine.difficulty.' + article.difficulty | t }}
                </span>
                <span
                  class="rounded-app bg-surface-300 px-2 py-0.5 text-[11px] font-bold text-text-secondary"
                >
                  {{ 'readingEngine.topic.' + article.topic | t }}
                </span>
                <span class="text-[11px] text-text-muted">
                  {{ 'readingEngine.wordCount' | t: { count: article.wordCount } }}
                </span>
              </div>
              <h2 class="text-lg font-black text-text-primary">{{ article.title }}</h2>
            </app-card>

            <app-card customClass="app-padded space-y-3">
              <p class="text-sm sm:text-base leading-relaxed text-text-primary whitespace-pre-line">
                {{ article.content }}
              </p>
            </app-card>

            <div class="flex flex-wrap gap-2">
              <app-button-secondary
                [ariaLabel]="'readingEngine.saveArticle' | t"
                customClass="text-[11px] sm:text-xs font-bold py-2.5 sm:py-2 px-3 sm:px-4 min-h-[44px] sm:min-h-0"
              >
                {{ 'readingEngine.saveArticle' | t }}
              </app-button-secondary>
              <app-button-secondary
                (clicked)="backToList()"
                [ariaLabel]="'readingEngine.nextArticle' | t"
                customClass="text-[11px] sm:text-xs font-bold py-2.5 sm:py-2 px-3 sm:px-4 min-h-[44px] sm:min-h-0"
              >
                {{ 'readingEngine.nextArticle' | t }}
              </app-button-secondary>
            </div>
          </div>
        } @else {
          <!-- Loading skeleton state -->
          @if (isLoading() && !hasError()) {
            <section
              class="space-y-4"
              role="status"
              [attr.aria-label]="'readingEngine.loadingArticles' | t"
            >
              @for (i of [1, 2, 3]; track i) {
                <app-card customClass="app-padded space-y-3">
                  <app-skeleton-loader
                    [height]="'20px'"
                    [width]="'60%'"
                    [borderRadius]="'6px'"
                  ></app-skeleton-loader>
                  <app-skeleton-loader
                    [height]="'14px'"
                    [width]="'90%'"
                    [borderRadius]="'4px'"
                  ></app-skeleton-loader>
                  <app-skeleton-loader
                    [height]="'14px'"
                    [width]="'75%'"
                    [borderRadius]="'4px'"
                  ></app-skeleton-loader>
                  <div class="flex gap-2 pt-1">
                    <app-skeleton-loader
                      [height]="'22px'"
                      [width]="'64px'"
                      [borderRadius]="'12px'"
                    ></app-skeleton-loader>
                    <app-skeleton-loader
                      [height]="'22px'"
                      [width]="'80px'"
                      [borderRadius]="'12px'"
                    ></app-skeleton-loader>
                  </div>
                </app-card>
              }
            </section>
          }

          <!-- Error state -->
          @if (hasError()) {
            <app-empty-state
              [icon]="'&#x26A0;&#xFE0F;'"
              [title]="'readingEngine.errorTitle' | t"
              [description]="'readingEngine.errorDescription' | t"
              [actionLabel]="'readingEngine.retryAction' | t"
              (actionClicked)="retryLoad()"
            >
            </app-empty-state>
          }

          <!-- Filter controls -->
          @if (!isLoading() && !hasError() && articlesResource.value()) {
            <div
              class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3"
              role="group"
              [attr.aria-label]="'readingEngine.filterControlsAriaLabel' | t"
            >
              <!-- Filter row: each group scrolls horizontally on small screens -->
              <div class="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span class="text-[10px] sm:text-[11px] font-bold text-text-muted flex-shrink-0">{{
                  'readingEngine.filterDifficulty' | t
                }}</span>
                <button
                  hlmBtn
                  type="button"
                  (click)="setFilter(null)"
                  [attr.aria-pressed]="!filterDifficulty()"
                  [class.bg-primary]="!filterDifficulty()"
                  [class.text-on-fill]="!filterDifficulty()"
                  [class.bg-surface-300]="filterDifficulty()"
                  class="rounded-app px-2 sm:px-2.5 py-1.5 sm:py-1 text-[10px] sm:text-[11px] font-bold transition-colors flex-shrink-0 min-h-[36px] sm:min-h-0"
                >
                  {{ 'readingEngine.filterAll' | t }}
                </button>
                @for (diff of ['beginner', 'intermediate', 'advanced']; track diff) {
                  <button
                    hlmBtn
                    type="button"
                    (click)="setFilter(diff)"
                    [attr.aria-pressed]="filterDifficulty() === diff"
                    [class.bg-primary]="filterDifficulty() === diff"
                    [class.text-on-fill]="filterDifficulty() === diff"
                    [class.bg-surface-300]="filterDifficulty() !== diff"
                    class="rounded-app px-2 sm:px-2.5 py-1.5 sm:py-1 text-[10px] sm:text-[11px] font-bold transition-colors flex-shrink-0 min-h-[36px] sm:min-h-0"
                  >
                    {{ 'readingEngine.difficulty.' + diff | t }}
                  </button>
                }
              </div>

              <div class="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span class="text-[10px] sm:text-[11px] font-bold text-text-muted flex-shrink-0">{{
                  'readingEngine.filterTopic' | t
                }}</span>
                <button
                  hlmBtn
                  type="button"
                  (click)="setTopicFilter(null)"
                  [attr.aria-pressed]="!filterTopic()"
                  [class.bg-primary]="!filterTopic()"
                  [class.text-on-fill]="!filterTopic()"
                  [class.bg-surface-300]="filterTopic()"
                  class="rounded-app px-2 sm:px-2.5 py-1.5 sm:py-1 text-[10px] sm:text-[11px] font-bold transition-colors flex-shrink-0 min-h-[36px] sm:min-h-0"
                >
                  {{ 'readingEngine.filterAll' | t }}
                </button>
                @for (topic of distinctTopics(); track topic) {
                  <button
                    hlmBtn
                    type="button"
                    (click)="setTopicFilter(topic)"
                    [attr.aria-pressed]="filterTopic() === topic"
                    [class.bg-primary]="filterTopic() === topic"
                    [class.text-on-fill]="filterTopic() === topic"
                    [class.bg-surface-300]="filterTopic() !== topic"
                    class="rounded-app px-2 sm:px-2.5 py-1.5 sm:py-1 text-[10px] sm:text-[11px] font-bold transition-colors flex-shrink-0 min-h-[36px] sm:min-h-0"
                  >
                    {{ 'readingEngine.topic.' + topic | t }}
                  </button>
                }
              </div>

              @if (filterDifficulty() || filterTopic()) {
                <button
                  hlmBtn
                  type="button"
                  (click)="clearFilters()"
                  class="text-[10px] sm:text-[11px] font-bold text-primary hover:underline py-1.5 sm:py-0 flex-shrink-0 min-h-[36px] sm:min-h-0"
                  [attr.aria-label]="'readingEngine.clearFilters' | t"
                >
                  {{ 'readingEngine.clearFilters' | t }}
                </button>
              }
            </div>
          }

          <!-- Empty state: no articles match filters -->
          @if (hasNoArticles() && !hasError() && !isLoading()) {
            <app-empty-state
              [icon]="'&#x1F4ED;'"
              [title]="'readingEngine.noArticlesTitle' | t"
              [description]="'readingEngine.noArticlesDescription' | t"
              [actionLabel]="'readingEngine.clearFilters' | t"
              (actionClicked)="clearFilters()"
            >
            </app-empty-state>
          }

          <!-- Article list -->
          @if (!isLoading() && !hasError() && filteredArticles().length > 0) {
            <div
              class="space-y-3"
              role="list"
              [attr.aria-label]="'readingEngine.articleListAriaLabel' | t"
            >
              @for (article of filteredArticles(); track article.id) {
                <app-card
                  variant="interactive"
                  (click)="selectArticle(article.id)"
                  (keyup.enter)="selectArticle(article.id)"
                  customClass="app-padded w-full text-start space-y-2 hover:bg-surface-300 transition-colors border border-transparent hover:border-surface-100"
                  [attr.aria-label]="
                    'readingEngine.openArticleAriaLabel' | t: { title: article.title }
                  "
                >
                  <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span
                      [class.bg-success/20]="article.difficulty === 'beginner'"
                      [class.text-success]="article.difficulty === 'beginner'"
                      [class.bg-warning/20]="article.difficulty === 'intermediate'"
                      [class.text-warning]="article.difficulty === 'intermediate'"
                      [class.bg-danger/20]="article.difficulty === 'advanced'"
                      [class.text-danger]="article.difficulty === 'advanced'"
                      class="rounded-app px-2 py-0.5 text-[10px] sm:text-[11px] font-bold"
                    >
                      {{ 'readingEngine.difficulty.' + article.difficulty | t }}
                    </span>
                    <span
                      class="rounded-app bg-surface-300 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-text-secondary"
                    >
                      {{ 'readingEngine.topic.' + article.topic | t }}
                    </span>
                    <span class="ms-auto text-[10px] sm:text-[11px] text-text-muted">
                      {{ 'readingEngine.wordCountShort' | t: { count: article.wordCount } }}
                    </span>
                  </div>
                  <h3 class="text-xs sm:text-sm font-bold text-text-primary">
                    {{ article.title }}
                  </h3>
                  <p class="text-[11px] sm:text-xs text-text-secondary line-clamp-2">
                    {{ article.content }}
                  </p>
                </app-card>
              }
            </div>
          }
        }
      </section>
    }

    @if (activeTab() === 'vocabulary') {
      <section
        class="space-y-4"
        role="tabpanel"
        id="reading-panel-vocabulary"
        [attr.aria-labelledby]="'reading-tab-vocabulary'"
        [attr.aria-hidden]="activeTab() !== 'vocabulary'"
      >
        <app-card customClass="app-padded space-y-3">
          <h3 class="text-base font-bold text-text-primary">
            {{ 'readingEngine.vocabularyTabTitle' | t }}
          </h3>
          <p class="app-muted">{{ 'readingEngine.vocabularyTabDescription' | t }}</p>
        </app-card>

        @if (vocabularyCount() === 0) {
          <app-empty-state
            [icon]="'&#x1F4DA;'"
            [title]="'readingEngine.noVocabularyTitle' | t"
            [description]="'readingEngine.noVocabularyDescription' | t"
            [actionLabel]="'readingEngine.browseArticlesAction' | t"
            (actionClicked)="activeTab.set('articles')"
          >
          </app-empty-state>
        } @else {
          <div class="mt-4">
            <app-vocabulary-dashboard [deckInput]="vocabCards()"></app-vocabulary-dashboard>
          </div>
        }
      </section>
    }

    @if (activeTab() === 'history') {
      <section
        class="space-y-4"
        role="tabpanel"
        id="reading-panel-history"
        [attr.aria-labelledby]="'reading-tab-history'"
        [attr.aria-hidden]="activeTab() !== 'history'"
      >
        <app-card customClass="app-padded space-y-3">
          <h3 class="text-base font-bold text-text-primary">
            {{ 'readingEngine.historyTabTitle' | t }}
          </h3>
          <p class="app-muted">{{ 'readingEngine.historyTabDescription' | t }}</p>
        </app-card>

        <app-empty-state
          [icon]="'&#x1F4D6;'"
          [title]="'readingEngine.noHistoryTitle' | t"
          [description]="'readingEngine.noHistoryDescription' | t"
          [actionLabel]="'readingEngine.browseArticlesAction' | t"
          (actionClicked)="activeTab.set('articles')"
        >
        </app-empty-state>
      </section>
    }
  </div> `,
  styles: [
    `
      :host {
        display: block;
      }
      .reading-engine {
        min-height: 60vh;
      }
    `,
  ],
})
export class ReadingEngineComponent {
  private i18n = inject(I18nService);
  private vocabStore = inject(VocabularyStore);
  private networkStatus = inject(NetworkStatusService);
  private offlineReading = inject(OfflineReadingService);

  readonly tabIds = TAB_IDS;

  readonly activeTab = signal<TabId>('articles');
  readonly selectedArticleId = signal<string | null>(null);
  readonly filterDifficulty = signal<string | null>(null);
  readonly filterTopic = signal<string | null>(null);

  readonly fetchError = signal<string | null>(null);
  readonly readingHistory = signal<ReadingHistoryEntry[]>([]);

  readonly articlesResource = resource<ReadingArticle[], unknown>({
    loader: async () => this.fetchArticles(),
  });

  readonly selectedArticle = computed<ReadingArticle | null>(() => {
    const articles = this.articlesResource.value();
    if (!articles || !this.selectedArticleId()) return null;
    return articles.find((a) => a.id === this.selectedArticleId()) ?? null;
  });

  readonly filteredArticles = computed<ReadingArticle[]>(() => {
    const articles = this.articlesResource.value();
    if (!articles) return [];
    const diff = this.filterDifficulty();
    const topic = this.filterTopic();
    return articles.filter(
      (a) => (!diff || a.difficulty === diff) && (!topic || a.topic === topic),
    );
  });

  readonly distinctTopics = computed<string[]>(() => {
    const articles = this.articlesResource.value();
    if (!articles) return [];
    return [...new Set(articles.map((a) => a.topic))].sort();
  });

  readonly isLoading = computed(() => this.articlesResource.isLoading());
  readonly hasError = computed(() => !!this.fetchError() || !!this.articlesResource.error());
  readonly hasNoArticles = computed(
    () => !this.isLoading() && !this.hasError() && this.filteredArticles().length === 0,
  );

  readonly isOffline = computed(() => !this.networkStatus.isOnline());
  readonly vocabularyCount = computed(() => this.vocabStore.allFlashcards().length);

  readonly vocabCards = computed(() =>
    this.vocabStore.allFlashcards().map((f) => ({
      id: f.id,
      term: f.word_token,
      definition: f.definition || f.translation,
      example: f.original_context,
      level: f.srs_level,
    })),
  );

  setTab(tabId: TabId): void {
    this.activeTab.set(tabId);
  }

  onTabKeydown(event: KeyboardEvent, currentTab: TabId): void {
    const idx = this.tabIds.indexOf(currentTab);
    /* istanbul ignore next: single-tab edge case */
    if (this.tabIds.length <= 1) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const targetIdx =
        event.key === 'ArrowRight'
          ? (idx + 1) % this.tabIds.length
          : (idx - 1 + this.tabIds.length) % this.tabIds.length;
      this.activeTab.set(this.tabIds[targetIdx]);
      const targetBtn = document.getElementById('reading-tab-' + this.tabIds[targetIdx]);
      targetBtn?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.activeTab.set(this.tabIds[0]);
      document.getElementById('reading-tab-' + this.tabIds[0])?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = this.tabIds[this.tabIds.length - 1];
      this.activeTab.set(last);
      document.getElementById('reading-tab-' + last)?.focus();
    }
  }

  selectArticle(id: string): void {
    this.selectedArticleId.set(id);
    this.fetchError.set(null);
  }

  backToList(): void {
    this.selectedArticleId.set(null);
  }

  setFilter(difficulty: string | null): void {
    this.filterDifficulty.set(difficulty);
  }

  setTopicFilter(topic: string | null): void {
    this.filterTopic.set(topic);
  }

  clearFilters(): void {
    this.filterDifficulty.set(null);
    this.filterTopic.set(null);
  }

  retryLoad(): void {
    this.fetchError.set(null);
    this.articlesResource.reload();
  }

  async loadReadingHistory(): Promise<void> {
    try {
      const history = await this.offlineReading.getReadingHistory();
      this.readingHistory.set(history as ReadingHistoryEntry[]);
    } catch {
      this.readingHistory.set([]);
    }
  }

  formatReadDate(timestamp: number): string {
    try {
      return new Date(timestamp).toLocaleDateString(this.i18n.currentLang(), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return new Date(timestamp).toLocaleDateString();
    }
  }

  private async fetchArticles(): Promise<ReadingArticle[]> {
    try {
      return [
        {
          id: '1',
          title: 'A Day in the Life of a Language Learner',
          content:
            'Every morning I wake up and start my day with a cup of coffee. I open my favourite language learning app and review my flashcards for ten minutes. Then I listen to a podcast in my target language while getting ready. During my commute I read news articles and look up new words. In the evening I practice speaking with my language exchange partner.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'daily-life',
          audioUrl: undefined,
          wordCount: 73,
        },
        {
          id: '2',
          title: 'The Benefits of Bilingualism',
          content:
            'Research has shown that speaking multiple languages can have profound effects on the brain. Bilingual individuals often demonstrate enhanced executive function, better attention control, and delayed onset of dementia in later life. The cognitive benefits extend beyond language processing to improved problem-solving skills and greater mental flexibility.',
          language: 'en-GB',
          difficulty: 'intermediate',
          topic: 'science',
          audioUrl: undefined,
          wordCount: 54,
        },
        {
          id: '3',
          title: 'Exploring Cultural Nuances Through Language',
          content:
            'Language is inextricably woven into the fabric of culture. When we learn a new language, we are not merely acquiring vocabulary and grammar rules; we are gaining access to an entirely different worldview. Idiomatic expressions, honourifics, and even the way colours are categorised can reveal profound insights about how a society thinks and what it values.',
          language: 'en-GB',
          difficulty: 'advanced',
          topic: 'culture',
          audioUrl: undefined,
          wordCount: 63,
        },
        {
          id: '4',
          title: 'How to Order Food Like a Local',
          content:
            'When travelling abroad, ordering food can be one of the most intimidating yet rewarding experiences. Learn the essential phrases for greeting the waiter, asking about ingredients, specifying dietary restrictions, and complimenting the chef. Understanding local dining customs will help you avoid cultural faux pas and make your meals more enjoyable.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'travel',
          audioUrl: undefined,
          wordCount: 58,
        },
        {
          id: '5',
          title: 'The Future of Machine Translation',
          content:
            'Neural machine translation has made remarkable strides in recent years, with transformer-based architectures achieving near-human performance on many language pairs. However, significant challenges remain: handling low-resource languages, preserving nuance and tone, and maintaining contextual coherence across long passages. The future likely lies in human-AI collaboration.',
          language: 'en-GB',
          difficulty: 'advanced',
          topic: 'technology',
          audioUrl: undefined,
          wordCount: 67,
        },
      ];
    } catch {
      this.fetchError.set(this.i18n.translate('readingEngine.fetchError'));
      return [];
    }
  }
}
