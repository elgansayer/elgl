import { Component, inject, signal, computed, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { NetworkStatusService } from '../../services/network-status.service';
import { OfflineReadingService } from '../../services/offline-reading.service';
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
  imports: [TranslatePipe, SanitiseHtmlPipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
  template: '',
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
  private networkStatus = inject(NetworkStatusService);
  private offlineReading = inject(OfflineReadingService);
  private readingApiUrl = `${environment.apiUrl}/reading`;

  readonly activeTab = signal<'articles' | 'vocabulary' | 'history'>('articles');
  readonly selectedArticleId = signal<string | null>(null);
  readonly filterDifficulty = signal<string | null>(null);
  readonly filterTopic = signal<string | null>(null);

  readonly fetchError = signal<string | null>(null);
  readonly readingHistory = signal<{ articleId: string; title: string; difficulty: string; topic: string; readAt: number }[]>([]);

  readonly isOffline = computed(() => !this.networkStatus.isOnline());
  readonly cachedArticlesCount = signal(0);

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

    const articles = this.articlesResource.value();
    const article = articles?.find((a) => a.id === id);
    if (article) {
      this.offlineReading
        .recordReadingHistory(article.id, article.title, article.difficulty, article.topic)
        .catch(() => undefined);
    }
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

  formatReadDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async loadReadingHistory(): Promise<void> {
    try {
      const entries = await this.offlineReading.getReadingHistory();
      this.readingHistory.set(entries);
    } catch {
      this.readingHistory.set([]);
    }
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
      const articles = list ?? [];

      this.offlineReading.cacheArticles(articles).catch(() => undefined);
      this.cachedArticlesCount.set(articles.length);

      return articles;
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await this.offlineReading.getCachedArticles();
        if (cached.length > 0) {
          this.cachedArticlesCount.set(cached.length);
          return cached.map((c) => ({
            id: c.id,
            title: c.title,
            content: c.content,
            language: c.language,
            difficulty: c.difficulty as ReadingArticle['difficulty'],
            topic: c.topic,
            audioUrl: c.audioUrl,
            wordCount: c.wordCount,
          }));
        }
      }
      this.fetchError.set(this.i18n.translate('readingEngine.fetchError'));
      return [];
    }
  }
}
