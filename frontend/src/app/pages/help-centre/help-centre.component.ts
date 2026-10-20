import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, computed, signal, resource } from '@angular/core';
import { HelpService, HelpQuery } from '../../services/help.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-help-centre',
  imports: [HlmInput, HlmButton, TranslatePipe],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-6">
      <h1 class="text-2xl font-bold mb-4">{{ 'help.centre.title' | t }}</h1>

      <input
        hlmInput
        type="text"
        [value]="searchQuery()"
        (input)="updateSearch($event)"
        [placeholder]="'help.centre.searchPlaceholder' | t"
        class="w-full p-2 rounded bg-surface border border-outline ps-3 pe-3 mb-4 text-sm"
      />

      <!-- category pills -->
      <div class="flex flex-wrap gap-2 mb-4">
        <button
          hlmBtn
          type="button"
          class="whitespace-nowrap rounded-full px-4 py-1 text-sm font-medium transition-colors"
          [class.bg-accent]="selectedCategory() === null"
          [class.text-accent-content]="selectedCategory() === null"
          [class.bg-surface]="selectedCategory() !== null"
          [class.text-dim]="selectedCategory() !== null"
          (click)="updateCategory(null)"
        >
          {{ 'discovery.filterAll' | t }}
        </button>
        @for (cat of categories.value() ?? []; track cat) {
          <button
            hlmBtn
            type="button"
            class="whitespace-nowrap rounded-full px-4 py-1 text-sm font-medium transition-colors"
            [class.bg-accent]="selectedCategory() === cat"
            [class.text-accent-content]="selectedCategory() === cat"
            [class.bg-surface]="selectedCategory() !== cat"
            [class.text-dim]="selectedCategory() !== cat"
            (click)="updateCategory(cat)"
          >
            {{ cat }}
          </button>
        }
      </div>

      @if (articles.isLoading()) {
        <div class="text-center py-8">{{ 'common.loading' | t }}</div>
      } @else if (articles.error()) {
        <div class="text-danger text-center py-4">{{ 'common.error_occurred' | t }}</div>
      } @else if ((articles.value()?.items?.length ?? 0) > 0) {
        @for (faq of articles.value()!.items; track faq.id) {
          <div class="bg-surface shadow-sm rounded-lg p-4 mb-3 border border-outline">
            <h3 class="font-semibold text-base mb-1">{{ faq.question }}</h3>
            <p class="text-sm text-dim">{{ faq.answer }}</p>
          </div>
        }

        <!-- pagination -->
        <div class="flex items-center justify-between mt-4">
          <button
            hlmBtn
            class="rounded bg-surface-200 px-3 py-1 disabled:opacity-40"
            [disabled]="page() <= 1"
            (click)="prevPage()"
          >
            &larr;
          </button>
          <span class="text-sm">{{ page() }} / {{ totalPages() }}</span>
          <button
            hlmBtn
            class="rounded bg-surface-200 px-3 py-1 disabled:opacity-40"
            [disabled]="(articles.value()?.items?.length ?? 0) < 10"
            (click)="nextPage()"
          >
            &rarr;
          </button>
        </div>
      } @else {
        <div class="text-center py-8">{{ 'help.centre.noResults' | t }}</div>
      }
    </div>
  `,
})
export class HelpCentreComponent {
  private readonly helpService = inject(HelpService);

  readonly searchQuery = signal<string>('');
  readonly selectedCategory = signal<string | null>(null);
  readonly page = signal<number>(1);

  private readonly request = computed<HelpQuery>(() => ({
    search: this.searchQuery() || undefined,
    category: this.selectedCategory() || undefined,
    page: this.page(),
    limit: 10,
  }));

  readonly categories = resource({
    loader: () => this.helpService.fetchCategories(),
  });

  readonly articles = resource({
    params: () => this.request(),
    loader: ({ params }) => this.helpService.fetchArticles(params),
  });

  readonly totalPages = computed<number>(() => {
    const result = this.articles.value();
    if (!result || result.total <= 0) return 1;
    return Math.ceil(result.total / result.limit);
  });

  updateSearch(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const value = target.value;
    this.searchQuery.set(value);
    this.page.set(1);
  }

  updateCategory(cat: string | null): void {
    this.selectedCategory.set(cat);
    this.page.set(1);
  }

  nextPage(): void {
    this.page.update((p) => p + 1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }
}
