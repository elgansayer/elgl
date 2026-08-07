import { Component, inject, signal, computed, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';

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
  imports: [TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
  template: `<div class="reading-engine mx-auto max-w-4xl space-y-6 pb-20 pt-4">
  <!-- Header & Tab Navigation -->
  <header class="app-card app-padded space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="app-section-title">{{ 'readingEngine.title' | t }}</h1>
        <p class="app-muted">{{ 'readingEngine.subtitle' | t }}</p>
      </div>
      <span class="app-chip bg-primary/20 text-primary font-bold text-xs" aria-live="polite">
        {{ 'readingEngine.vocabularyCount' | t: { count: vocabularyCount() } }}
      </span>
    </div>

    <nav class="flex gap-2 border-b border-surface-100 pb-2" role="tablist" [attr.aria-label]="'readingEngine.tabNavAriaLabel' | t">
      <button type="button" role="tab"
        id="tab-articles"
        aria-controls="panel-articles"
        [attr.aria-selected]="activeTab() === 'articles'"
        [attr.tabindex]="activeTab() === 'articles' ? 0 : -1"
        (click)="activeTab.set('articles')"
        (keydown.arrowLeft)="focusPreviousTab($event)"
        (keydown.arrowRight)="focusNextTab($event)"
        (keydown.home)="focusFirstTab($event)"
        (keydown.end)="focusLastTab($event)"
        [class.bg-primary]="activeTab() === 'articles'" [class.text-white]="activeTab() === 'articles'"
        [class.bg-surface-300]="activeTab() !== 'articles'" [class.text-text-secondary]="activeTab() !== 'articles'"
        class="rounded-app px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary">
        {{ 'readingEngine.tab.articles' | t }}
      </button>
      <button type="button" role="tab"
        id="tab-vocabulary"
        aria-controls="panel-vocabulary"
        [attr.aria-selected]="activeTab() === 'vocabulary'"
        [attr.tabindex]="activeTab() === 'vocabulary' ? 0 : -1"
        (click)="activeTab.set('vocabulary')"
        (keydown.arrowLeft)="focusPreviousTab($event)"
        (keydown.arrowRight)="focusNextTab($event)"
        (keydown.home)="focusFirstTab($event)"
        (keydown.end)="focusLastTab($event)"
        [class.bg-primary]="activeTab() === 'vocabulary'" [class.text-white]="activeTab() === 'vocabulary'"
        [class.bg-surface-300]="activeTab() !== 'vocabulary'" [class.text-text-secondary]="activeTab() !== 'vocabulary'"
        class="rounded-app px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary">
        {{ 'readingEngine.tab.vocabulary' | t }}
      </button>
      <button type="button" role="tab"
        id="tab-history"
        aria-controls="panel-history"
        [attr.aria-selected]="activeTab() === 'history'"
        [attr.tabindex]="activeTab() === 'history' ? 0 : -1"
        (click)="activeTab.set('history')"
        (keydown.arrowLeft)="focusPreviousTab($event)"
        (keydown.arrowRight)="focusNextTab($event)"
        (keydown.home)="focusFirstTab($event)"
        (keydown.end)="focusLastTab($event)"
        [class.bg-primary]="activeTab() === 'history'" [class.text-white]="activeTab() === 'history'"
        [class.bg-surface-300]="activeTab() !== 'history'" [class.text-text-secondary]="activeTab() !== 'history'"
        class="rounded-app px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary">
        {{ 'readingEngine.tab.history' | t }}
      </button>
    </nav>
  </header>

  @if (activeTab() === 'articles') {
    <section id="panel-articles" role="tabpanel" aria-labelledby="tab-articles" [attr.tabindex]="0">
    @if (selectedArticle(); as article) {
      <div class="space-y-4">
        <button type="button" (click)="backToList()"
          class="app-button-secondary text-xs font-bold flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-primary"
          [attr.aria-label]="('readingEngine.backToArticleList' | t: { title: article.title })">
          <span aria-hidden="true">&larr;</span>
          {{ 'readingEngine.backToList' | t }}
        </button>

        <div class="app-card app-padded space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <span
              [class.bg-emerald-500/20]="article.difficulty === 'beginner'"
              [class.text-emerald-400]="article.difficulty === 'beginner'"
              [class.bg-amber-500/20]="article.difficulty === 'intermediate'"
              [class.text-amber-400]="article.difficulty === 'intermediate'"
              [class.bg-rose-500/20]="article.difficulty === 'advanced'"
              [class.text-rose-400]="article.difficulty === 'advanced'"
              class="rounded-app px-2 py-0.5 text-[11px] font-bold"
              role="status">
              {{ 'readingEngine.difficulty.' + article.difficulty | t }}
            </span>
            <span class="rounded-app bg-surface-300 px-2 py-0.5 text-[11px] font-bold text-text-secondary">
              {{ 'readingEngine.topic.' + article.topic | t }}
            </span>
            <span class="text-[11px] text-text-muted">
              {{ 'readingEngine.wordCount' | t: { count: article.wordCount } }}
            </span>
          </div>
          <h2 class="text-lg font-black text-text-primary">{{ article.title }}</h2>
        </div>

        <article class="app-card app-padded space-y-3" [attr.aria-label]="('readingEngine.articleContentAriaLabel' | t: { title: article.title })" role="article">
          <p class="text-base leading-relaxed text-text-primary whitespace-pre-line">{{ article.content }}</p>
        </article>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="app-button-secondary text-xs font-bold focus-visible:outline-2 focus-visible:outline-primary"
            [attr.aria-label]="'readingEngine.saveArticleAriaLabel' | t: { title: article.title }">
            {{ 'readingEngine.saveArticle' | t }}
          </button>
          <button type="button" (click)="backToList()" class="app-button-secondary text-xs font-bold focus-visible:outline-2 focus-visible:outline-primary"
            [attr.aria-label]="'readingEngine.nextArticle' | t">
            {{ 'readingEngine.nextArticle' | t }}
          </button>
        </div>
      </div>
    } @else {
      <!-- Loading skeleton state -->
      @if (isLoading() && !hasError()) {
        <section class="space-y-4" role="status" aria-busy="true" [attr.aria-label]="'readingEngine.loadingArticles' | t">
          @for (i of [1, 2, 3]; track i) {
            <div class="app-card app-padded space-y-3" aria-hidden="true">
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
        <div role="alert">
          <app-empty-state
            [icon]="'&#x26A0;&#xFE0F;'"
            [title]="'readingEngine.errorTitle' | t"
            [description]="'readingEngine.errorDescription' | t"
            [actionLabel]="'readingEngine.retryAction' | t"
            (actionClicked)="retryLoad()">
          </app-empty-state>
        </div>
      }

      <!-- Filter controls -->
      @if (!isLoading() && !hasError() && articlesResource.value()) {
        <div class="flex flex-wrap items-center gap-3" role="group" [attr.aria-label]="'readingEngine.filterControlsAriaLabel' | t">
          <fieldset class="flex items-center gap-1.5 border-0 p-0" role="radiogroup" [attr.aria-label]="'readingEngine.filterDifficultyAriaLabel' | t">
            <legend class="sr-only">{{ 'readingEngine.filterDifficulty' | t }}</legend>
            <button type="button" (click)="setFilter(null)"
              role="radio" [attr.aria-checked]="!filterDifficulty()"
              [class.bg-primary]="!filterDifficulty()" [class.text-white]="!filterDifficulty()"
              [class.bg-surface-300]="filterDifficulty()"
              class="rounded-app px-2.5 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary">
              {{ 'readingEngine.filterAll' | t }}
            </button>
            @for (diff of ['beginner', 'intermediate', 'advanced']; track diff) {
              <button type="button" (click)="setFilter(diff)"
                role="radio" [attr.aria-checked]="filterDifficulty() === diff"
                [class.bg-primary]="filterDifficulty() === diff" [class.text-white]="filterDifficulty() === diff"
                [class.bg-surface-300]="filterDifficulty() !== diff"
                class="rounded-app px-2.5 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary">
                {{ 'readingEngine.difficulty.' + diff | t }}
              </button>
            }
          </fieldset>

          <fieldset class="flex items-center gap-1.5 border-0 p-0" role="radiogroup" [attr.aria-label]="'readingEngine.filterTopicAriaLabel' | t">
            <legend class="sr-only">{{ 'readingEngine.filterTopic' | t }}</legend>
            <button type="button" (click)="setTopicFilter(null)"
              role="radio" [attr.aria-checked]="!filterTopic()"
              [class.bg-primary]="!filterTopic()" [class.text-white]="!filterTopic()"
              [class.bg-surface-300]="filterTopic()"
              class="rounded-app px-2.5 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary">
              {{ 'readingEngine.filterAll' | t }}
            </button>
            @for (topic of distinctTopics(); track topic) {
              <button type="button" (click)="setTopicFilter(topic)"
                role="radio" [attr.aria-checked]="filterTopic() === topic"
                [class.bg-primary]="filterTopic() === topic" [class.text-white]="filterTopic() === topic"
                [class.bg-surface-300]="filterTopic() !== topic"
                class="rounded-app px-2.5 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary">
                {{ 'readingEngine.topic.' + topic | t }}
              </button>
            }
          </fieldset>

          @if (filterDifficulty() || filterTopic()) {
            <button type="button" (click)="clearFilters()"
              class="text-[11px] font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              [attr.aria-label]="'readingEngine.clearFiltersAriaLabel' | t">
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
        <ul class="space-y-3 list-none p-0 m-0" role="list" [attr.aria-label]="'readingEngine.articleListAriaLabel' | t">
          @for (article of filteredArticles(); track article.id) {
            <li role="listitem">
              <button type="button"
                (click)="selectArticle(article.id)"
                class="app-card app-padded w-full text-start space-y-2 hover:bg-surface-300 transition-colors cursor-pointer border border-transparent hover:border-surface-100 focus-visible:outline-2 focus-visible:outline-primary"
                [attr.aria-label]="('readingEngine.openArticleAriaLabel' | t: { title: article.title, difficulty: ('readingEngine.difficulty.' + article.difficulty | t), topic: ('readingEngine.topic.' + article.topic | t) })"
                [attr.aria-describedby]="'article-desc-' + article.id">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    [class.bg-emerald-500/20]="article.difficulty === 'beginner'"
                    [class.text-emerald-400]="article.difficulty === 'beginner'"
                    [class.bg-amber-500/20]="article.difficulty === 'intermediate'"
                    [class.text-amber-400]="article.difficulty === 'intermediate'"
                    [class.bg-rose-500/20]="article.difficulty === 'advanced'"
                    [class.text-rose-400]="article.difficulty === 'advanced'"
                    class="rounded-app px-2 py-0.5 text-[11px] font-bold">
                    {{ 'readingEngine.difficulty.' + article.difficulty | t }}
                  </span>
                  <span class="rounded-app bg-surface-300 px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                    {{ 'readingEngine.topic.' + article.topic | t }}
                  </span>
                  <span class="ms-auto text-[11px] text-text-muted">
                    {{ 'readingEngine.wordCountShort' | t: { count: article.wordCount } }}
                  </span>
                </div>
                <h3 class="text-sm font-bold text-text-primary">{{ article.title }}</h3>
                <p [id]="'article-desc-' + article.id" class="text-xs text-text-secondary line-clamp-2">{{ article.content }}</p>
              </button>
            </li>
          }
        </ul>
      }
    }
    </section>
  }

  @if (activeTab() === 'vocabulary') {
    <section id="panel-vocabulary" role="tabpanel" aria-labelledby="tab-vocabulary" [attr.tabindex]="0" class="space-y-4">
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
    <section id="panel-history" role="tabpanel" aria-labelledby="tab-history" [attr.tabindex]="0" class="space-y-4">
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
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }
    `,
  ],
})
export class ReadingEngineComponent {
  private i18n = inject(I18nService);
  private vocabStore = inject(VocabularyStore);

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

  private readonly tabIds: readonly string[] = ['tab-articles', 'tab-vocabulary', 'tab-history'];

  focusPreviousTab(event: KeyboardEvent): void {
    event.preventDefault();
    const currentTab = document.activeElement;
    if (!currentTab) return;
    const currentIdx = this.tabIds.findIndex((id) => id === (currentTab as HTMLElement).id);
    const prevIdx = currentIdx <= 0 ? this.tabIds.length - 1 : currentIdx - 1;
    this.focusTabById(this.tabIds[prevIdx]);
  }

  focusNextTab(event: KeyboardEvent): void {
    event.preventDefault();
    const currentTab = document.activeElement;
    if (!currentTab) return;
    const currentIdx = this.tabIds.findIndex((id) => id === (currentTab as HTMLElement).id);
    const nextIdx = currentIdx >= this.tabIds.length - 1 ? 0 : currentIdx + 1;
    this.focusTabById(this.tabIds[nextIdx]);
  }

  focusFirstTab(event: KeyboardEvent): void {
    event.preventDefault();
    this.focusTabById(this.tabIds[0]);
  }

  focusLastTab(event: KeyboardEvent): void {
    event.preventDefault();
    this.focusTabById(this.tabIds[this.tabIds.length - 1]);
  }

  private focusTabById(id: string): void {
    const el = document.getElementById(id);
    el?.focus();
  }

  private async fetchArticles(): Promise<ReadingArticle[]> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return [
        {
          id: '1',
          title: 'A Day in the Life of a Language Learner',
          content: 'Every morning I wake up and start my day with a cup of coffee. I open my favourite language learning app and review my flashcards for ten minutes. Then I listen to a podcast in my target language while getting ready. During my commute I read news articles and look up new words. In the evening I practice speaking with my language exchange partner.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'daily-life',
          audioUrl: undefined,
          wordCount: 73,
        },
        {
          id: '2',
          title: 'The Benefits of Bilingualism',
          content: 'Research has shown that speaking multiple languages can have profound effects on the brain. Bilingual individuals often demonstrate enhanced executive function, better attention control, and delayed onset of dementia in later life. The cognitive benefits extend beyond language processing to improved problem-solving skills and greater mental flexibility.',
          language: 'en-GB',
          difficulty: 'intermediate',
          topic: 'science',
          audioUrl: undefined,
          wordCount: 54,
        },
        {
          id: '3',
          title: 'Exploring Cultural Nuances Through Language',
          content: 'Language is inextricably woven into the fabric of culture. When we learn a new language, we are not merely acquiring vocabulary and grammar rules; we are gaining access to an entirely different worldview. Idiomatic expressions, honourifics, and even the way colours are categorised can reveal profound insights about how a society thinks and what it values.',
          language: 'en-GB',
          difficulty: 'advanced',
          topic: 'culture',
          audioUrl: undefined,
          wordCount: 63,
        },
        {
          id: '4',
          title: 'How to Order Food Like a Local',
          content: 'When travelling abroad, ordering food can be one of the most intimidating yet rewarding experiences. Learn the essential phrases for greeting the waiter, asking about ingredients, specifying dietary restrictions, and complimenting the chef. Understanding local dining customs will help you avoid cultural faux pas and make your meals more enjoyable.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'travel',
          audioUrl: undefined,
          wordCount: 58,
        },
        {
          id: '5',
          title: 'The Future of Machine Translation',
          content: 'Neural machine translation has made remarkable strides in recent years, with transformer-based architectures achieving near-human performance on many language pairs. However, significant challenges remain: handling low-resource languages, preserving nuance and tone, and maintaining contextual coherence across long passages. The future likely lies in human-AI collaboration.',
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
