import { Component, inject, signal, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { HelpFaqService } from '../../services/help-faq.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-help-centre',
  standalone: true,
  imports: [TranslatePipe, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-6">
      <h1 class="text-2xl font-bold mb-4">{{ 'help_centre.title' | t }}</h1>

      <!-- category pills -->
      @let cats = categoriesResource.value();
      <div class="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          type="button"
          class="whitespace-nowrap rounded-full px-4 py-1 text-sm font-medium transition-colors"
          [class.bg-accent]="selectedCategory() === undefined"
          [class.text-accent-content]="selectedCategory() === undefined"
          [class.bg-surface]="selectedCategory() !== undefined"
          [class.text-dim]="selectedCategory() !== undefined"
          (click)="selectCategory('all')"
        >
          {{ 'help_centre.all_categories' | t }}
        </button>
        @for (cat of cats ?? []; track cat) {
          <button
            type="button"
            class="whitespace-nowrap rounded-full px-4 py-1 text-sm font-medium transition-colors"
            [class.bg-accent]="selectedCategory() === cat"
            [class.text-accent-content]="selectedCategory() === cat"
            [class.bg-surface]="selectedCategory() !== cat"
            [class.text-dim]="selectedCategory() !== cat"
            (click)="selectCategory(cat)"
          >
            {{ cat }}
          </button>
        }
      </div>

      <!-- search input -->
      <div class="mb-6">
        <input
          type="text"
          [placeholder]="'help_centre.search_placeholder' | t"
          [ngModel]="searchText()"
          (ngModelChange)="searchText.set($event)"
          class="w-full p-2 rounded bg-surface border border-outline ps-3 pe-3 text-sm"
        />
      </div>

      <!-- loading -->
      @if (articlesResource.isLoading()) {
        <div class="text-center py-8">{{ 'common.loading' | t }}</div>
      }

      <!-- error -->
      @if (articlesResource.error()) {
        <div class="text-red-500 text-center py-4">
          {{ 'common.error_occurred' | t }}
        </div>
      }

      <!-- articles -->
      @if (!articlesResource.isLoading() && !articlesResource.error()) {
        @for (faq of articlesResource.value()?.items ?? []; track faq.id) {
          <div
            class="bg-surface shadow-sm rounded-lg p-4 mb-3 border border-outline"
          >
            <h3 class="font-semibold text-base mb-1">{{ faq.question }}</h3>
            <p class="text-sm text-dim">{{ faq.answer }}</p>
          </div>
        } @empty {
          <div class="text-center py-8">
            {{ 'help_centre.no_articles' | t }}
          </div>
        }
      }
    </div>
  `,
})
export class HelpCentreComponent {
  private helpService = inject(HelpFaqService);
  protected searchText = signal<string>('');
  protected selectedCategory = signal<string | undefined>(undefined);

  protected categoriesResource = resource({
    loader: async () => {
      const cats = await this.helpService.getCategories();
      return cats ?? [];
    },
    defaultValue: [],
  });

  protected articlesResource = resource({
    params: () => ({
      search: this.searchText(),
      category: this.selectedCategory(),
    }),
    loader: async ({ params }) => {
      const res = await this.helpService.getFAQs(
        params.category,
      );
      return (
        res ?? { items: [], total: 0, page: 1, limit: 50 }
      );
    },
    defaultValue: { items: [], total: 0, page: 1, limit: 50 },
  });

  protected selectCategory(cat: string): void {
    this.selectedCategory.set(cat === 'all' ? undefined : cat);
  }
}
