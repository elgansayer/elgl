import { Component, inject, signal, computed, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { environment } from '../../environments/environment';

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

@Component({
  selector: 'app-reading-engine',
  standalone: true,
<<<<<<< HEAD
  imports: [TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
  template: `<div class="reading-engine mx-auto max-w-4xl space-y-4 sm:space-y-6 pb-20 pt-2 sm:pt-4">
=======
  imports: [TranslatePipe, SanitiseHtmlPipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
  template: `<div class="reading-engine mx-auto max-w-4xl space-y-6 pb-20 pt-4">
>>>>>>> origin/main
  <!-- Header & Tab Navigation -->
  <header class="app-card app-padded space-y-3 sm:space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="app-section-title text-base sm:text-lg">{{ 'readingEngine.title' | t }}</h1>
        <p class="app-muted text-[11px] sm:text-xs">{{ 'readingEngine.subtitle' | t }}</p>
      </div>
      <span class="app-chip bg-primary/20 text-primary font-bold text-[10px] sm:text-xs shrink-0">
        {{ 'readingEngine.vocabularyCount' | t: { count: vocabularyCount() } }}
      </span>
    </div>

    <nav class="app-filter-scroll border-b border-surface-100 pb-2" role="tablist" [attr.aria-label]="'readingEngine.tabNavAriaLabel' | t">
      <button type="button" role="tab"
        [attr.aria-selected]="activeTab() === 'articles'"
        (click)="activeTab.set('articles')"
        [class.bg-primary]="activeTab() === 'articles'" [class.text-white]="activeTab() === 'articles'"
        [class.bg-surface-300]="activeTab() !== 'articles'" [class.text-text-secondary]="activeTab() !== 'articles'"
        class="rounded-app px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-colors shrink-0">
        {{ 'readingEngine.tab.articles' | t }}
      </button>
      <button type="button" role="tab"
        [attr.aria-selected]="activeTab() === 'vocabulary'"
        (click)="activeTab.set('vocabulary')"
        [class.bg-primary]="activeTab() === 'vocabulary'" [class.text-white]="activeTab() === 'vocabulary'"
        [class.bg-surface-300]="activeTab() !== 'vocabulary'" [class.text-text-secondary]="activeTab() !== 'vocabulary'"
        class="rounded-app px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-colors shrink-0">
        {{ 'readingEngine.tab.vocabulary' | t }}
      </button>
      <button type="button" role="tab"
        [attr.aria-selected]="activeTab() === 'history'"
        (click)="activeTab.set('history')"
        [class.bg-primary]="activeTab() === 'history'" [class.text-white]="activeTab() === 'history'"
        [class.bg-surface-300]="activeTab() !== 'history'" [class.text-text-secondary]="activeTab() !== 'history'"
        class="rounded-app px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-colors shrink-0">
        {{ 'readingEngine.tab.history' | t }}
      </button>
    </nav>
  </header>

  @if (activeTab() === 'articles') {
    @if (selectedArticle(); as article) {
      <div class="space-y-3 sm:space-y-4">
        <button type="button" (click)="backToList()"
          class="app-button-secondary text-[11px] sm:text-xs font-bold flex items-center gap-1.5"
          [attr.aria-label]="'readingEngine.backToList' | t">
          <span aria-hidden="true">&larr;</span>
          {{ 'readingEngine.backToList' | t }}
        </button>

        <div class="app-card app-padded space-y-2">
          <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span
              [class.bg-emerald-500/20]="article.difficulty === 'beginner'"
              [class.text-emerald-400]="article.difficulty === 'beginner'"
              [class.bg-amber-500/20]="article.difficulty === 'intermediate'"
              [class.text-amber-400]="article.difficulty === 'intermediate'"
              [class.bg-rose-500/20]="article.difficulty === 'advanced'"
              [class.text-rose-400]="article.difficulty === 'advanced'"
              class="rounded-app px-2 py-0.5 text-[10px] sm:text-[11px] font-bold">
              {{ 'readingEngine.difficulty.' + article.difficulty | t }}
            </span>
            <span class="rounded-app bg-surface-300 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-text-secondary">
              {{ 'readingEngine.topic.' + article.topic | t }}
            </span>
            <span class="text-[10px] sm:text-[11px] text-text-muted">
              {{ 'readingEngine.wordCount' | t: { count: article.wordCount } }}
            </span>
          </div>
<<<<<<< HEAD
          <h2 class="text-base sm:text-lg font-black text-text-primary">{{ article.title }}</h2>
        </div>

        <div class="app-card app-padded space-y-3">
          <p class="text-sm sm:text-base leading-relaxed text-text-primary whitespace-pre-line">{{ article.content }}</p>
=======
          <h2 class="text-lg font-black text-text-primary">{{ article.title | sanitiseHtml }}</h2>
        </div>

        <div class="app-card app-padded space-y-3">
          <p class="text-base leading-relaxed text-text-primary whitespace-pre-line">{{ article.content | sanitiseHtml }}</p>
>>>>>>> origin/main
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="app-button-secondary text-[11px] sm:text-xs font-bold"
            [attr.aria-label]="'readingEngine.saveArticle' | t">
            {{ 'readingEngine.saveArticle' | t }}
          </button>
          <button type="button" (click)="backToList()" class="app-button-secondary text-[11px] sm:text-xs font-bold"
            [attr.aria-label]="'readingEngine.nextArticle' | t">
            {{ 'readingEngine.nextArticle' | t }}
          </button>
        </div>
      </div>
    } @else {
      <!-- Loading skeleton state -->
      @if (isLoading() && !hasError()) {
        <section class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" role="status" [attr.aria-label]="'readingEngine.loadingArticles' | t">
          @for (i of [1, 2, 3]; track i) {
            <div class="app-card app-padded space-y-3">
              <app-skeleton-loader [height]="'20px'" [width]="'60%'" [borderRadius]="'6px'"></app-skeleton-loader>
              <app-skeleton-loader [height]="'14px'" [width]="'90%'" [borderRadius]="'4px'"></app-skeleton-loader>
              <app-skeleton-loader [height]="'14px'" [width]="'75%'" [borderRadius]="'4px'"></app-skeleton-loader>
              <div class="flex gap-2 pt-1">
                <app-skeleton-loader [height]="'22px'" [width]="'64px'" [borderRadius]="'12px'"></app-skeleton-loader>
                <app-skeleton-loader [height]="'22px'" [width]="'80px'" [borderRadius]="'12px'"></app-skeleton-loader>
              </div>
            </div>
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
          (actionClicked)="retryLoad()">
        </app-empty-state>
      }

      <!-- Filter controls -->
      @if (!isLoading() && !hasError() && articlesResource.value()) {
        <div class="space-y-2 sm:space-y-3" role="group" [attr.aria-label]="'readingEngine.filterControlsAriaLabel' | t">
          <div class="app-filter-scroll">
            <span class="text-[10px] sm:text-[11px] font-bold text-text-muted me-1.5 shrink-0 self-center">{{ 'readingEngine.filterDifficulty' | t }}</span>
            <button type="button" (click)="setFilter(null)"
              [class.bg-primary]="!filterDifficulty()" [class.text-white]="!filterDifficulty()"
              [class.bg-surface-300]="filterDifficulty()"
              class="rounded-app px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-bold transition-colors shrink-0">
              {{ 'readingEngine.filterAll' | t }}
            </button>
            @for (diff of ['beginner', 'intermediate', 'advanced']; track diff) {
              <button type="button" (click)="setFilter(diff)"
                [class.bg-primary]="filterDifficulty() === diff" [class.text-white]="filterDifficulty() === diff"
                [class.bg-surface-300]="filterDifficulty() !== diff"
                class="rounded-app px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-bold transition-colors shrink-0">
                {{ 'readingEngine.difficulty.' + diff | t }}
              </button>
            }
          </div>

          <div class="app-filter-scroll">
            <span class="text-[10px] sm:text-[11px] font-bold text-text-muted me-1.5 shrink-0 self-center">{{ 'readingEngine.filterTopic' | t }}</span>
            <button type="button" (click)="setTopicFilter(null)"
              [class.bg-primary]="!filterTopic()" [class.text-white]="!filterTopic()"
              [class.bg-surface-300]="filterTopic()"
              class="rounded-app px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-bold transition-colors shrink-0">
              {{ 'readingEngine.filterAll' | t }}
            </button>
            @for (topic of distinctTopics(); track topic) {
              <button type="button" (click)="setTopicFilter(topic)"
                [class.bg-primary]="filterTopic() === topic" [class.text-white]="filterTopic() === topic"
                [class.bg-surface-300]="filterTopic() !== topic"
                class="rounded-app px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-bold transition-colors shrink-0">
                {{ 'readingEngine.topic.' + topic | t }}
              </button>
            }
          </div>

          @if (filterDifficulty() || filterTopic()) {
            <button type="button" (click)="clearFilters()"
              class="text-[10px] sm:text-[11px] font-bold text-primary hover:underline">
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
          (actionClicked)="clearFilters()">
        </app-empty-state>
      }

      <!-- Article list -->
      @if (!isLoading() && !hasError() && filteredArticles().length > 0) {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" role="list" [attr.aria-label]="'readingEngine.articleListAriaLabel' | t">
          @for (article of filteredArticles(); track article.id) {
            <button type="button" role="listitem"
              (click)="selectArticle(article.id)"
              class="app-card app-padded w-full text-start space-y-2 hover:bg-surface-300 transition-colors cursor-pointer border border-transparent hover:border-surface-100"
              [attr.aria-label]="'readingEngine.openArticleAriaLabel' | t: { title: article.title }">
              <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span
                  [class.bg-emerald-500/20]="article.difficulty === 'beginner'"
                  [class.text-emerald-400]="article.difficulty === 'beginner'"
                  [class.bg-amber-500/20]="article.difficulty === 'intermediate'"
                  [class.text-amber-400]="article.difficulty === 'intermediate'"
                  [class.bg-rose-500/20]="article.difficulty === 'advanced'"
                  [class.text-rose-400]="article.difficulty === 'advanced'"
                  class="rounded-app px-2 py-0.5 text-[10px] sm:text-[11px] font-bold">
                  {{ 'readingEngine.difficulty.' + article.difficulty | t }}
                </span>
                <span class="rounded-app bg-surface-300 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-text-secondary">
                  {{ 'readingEngine.topic.' + article.topic | t }}
                </span>
                <span class="ms-auto text-[10px] sm:text-[11px] text-text-muted">
                  {{ 'readingEngine.wordCountShort' | t: { count: article.wordCount } }}
                </span>
              </div>
              <h3 class="text-sm font-bold text-text-primary">{{ article.title | sanitiseHtml }}</h3>
              <p class="text-xs text-text-secondary line-clamp-2">{{ article.content | sanitiseHtml }}</p>
            </button>
          }
        </div>
      }
    }
  }

  @if (activeTab() === 'vocabulary') {
    <section class="space-y-4">
      <div class="app-card app-padded space-y-3">
        <h3 class="text-base font-bold text-text-primary">{{ 'readingEngine.vocabularyTabTitle' | t }}</h3>
        <p class="app-muted">{{ 'readingEngine.vocabularyTabDescription' | t }}</p>
      </div>

      @if (vocabularyCount() === 0) {
        <app-empty-state
          [icon]="'&#x1F4DA;'"
          [title]="'readingEngine.noVocabularyTitle' | t"
          [description]="'readingEngine.noVocabularyDescription' | t"
          [actionLabel]="'readingEngine.browseArticlesAction' | t"
          (actionClicked)="activeTab.set('articles')">
        </app-empty-state>
      } @else {
        <div class="app-card app-padded space-y-2">
          <p class="text-sm font-bold text-text-primary">{{ 'readingEngine.vocabularyPlaceholder' | t }}</p>
        </div>
      }
    </section>
  }

  @if (activeTab() === 'history') {
    <section class="space-y-4">
      <div class="app-card app-padded space-y-3">
        <h3 class="text-base font-bold text-text-primary">{{ 'readingEngine.historyTabTitle' | t }}</h3>
        <p class="app-muted">{{ 'readingEngine.historyTabDescription' | t }}</p>
      </div>

      <app-empty-state
        [icon]="'&#x1F4D6;'"
        [title]="'readingEngine.noHistoryTitle' | t"
        [description]="'readingEngine.noHistoryDescription' | t"
        [actionLabel]="'readingEngine.browseArticlesAction' | t"
        (actionClicked)="activeTab.set('articles')">
      </app-empty-state>
    </section>
  }
</div>
`,
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
  private http = inject(HttpClient);
  private readingApiUrl = `${environment.apiUrl}/reading`;

  readonly activeTab = signal<'articles' | 'vocabulary' | 'history'>('articles');
  readonly selectedArticleId = signal<string | null>(null);
  readonly filterDifficulty = signal<string | null>(null);
  readonly filterTopic = signal<string | null>(null);

  readonly fetchError = signal<string | null>(null);

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

  readonly vocabularyCount = computed(() => this.vocabStore.allFlashcards().length);

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

  private async fetchArticles(): Promise<ReadingArticle[]> {
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('offset', '0');
      const list = await firstValueFrom(
        this.http.get<ReadingArticle[]>(
          `${this.readingApiUrl}/resources?${params.toString()}`,
        ),
      );
      return list ?? [];
    } catch {
      this.fetchError.set(this.i18n.translate('readingEngine.fetchError'));
      return [];
    }
  }
}
