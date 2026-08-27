import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, resource } from '@angular/core';
import { HelpFaqService, FAQResponse } from '../../services/help-faq.service';
import { I18nService } from '../../services/i18n.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-support-centre',
  imports: [HlmCheckbox, HlmButton, CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container mx-auto p-4 max-w-4xl">
      <h1 class="text-2xl font-bold mb-4">{{ 'support.title' | t }}</h1>
      <p class="text-base-content/70 mb-6">{{ 'support.subtitle' | t }}</p>

      <div class="flex flex-wrap gap-2 mb-6">
        <button
          hlmBtn
          [class.btn-primary]="selectedCategory() === ''"
          [class.btn-outline]="selectedCategory() !== ''"
          class="btn btn-sm"
          (click)="selectedCategory.set('')"
        >
          {{ 'support.allCategories' | t }}
        </button>
        @for (cat of categories(); track cat) {
          <button
            hlmBtn
            [class.btn-primary]="selectedCategory() === cat"
            [class.btn-outline]="selectedCategory() !== cat"
            class="btn btn-sm"
            (click)="selectedCategory.set(cat)"
          >
            {{ cat }}
          </button>
        }
      </div>

      @if (faqResource.isLoading()) {
        <p class="text-center text-base-content/50">{{ 'common.loading' | t }}</p>
      } @else if (faqResource.error()) {
        <p class="text-center text-error">{{ 'common.loadError' | t }}</p>
      } @else if (faqResource.value()?.items?.length === 0) {
        <p class="text-center text-base-content/30">{{ 'support.noResults' | t }}</p>
      } @else {
        <div class="space-y-4">
          @for (faq of faqResource.value()?.items ?? []; track faq.id) {
            <div class="collapse collapse-arrow bg-base-200 rounded-lg">
              <hlm-checkbox />
              <div class="collapse-title text-lg font-medium cursor-pointer">
                {{ faq.question }}
              </div>
              <div class="collapse-content">
                <p class="whitespace-pre-line text-base-content/80">
                  {{ faq.answer }}
                </p>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SupportCentreComponent {
  private helpFaqService = inject(HelpFaqService);
  private i18n = inject(I18nService);

  readonly selectedCategory = signal<string>('');
  readonly categories = signal<string[]>([]);

  protected readonly faqResource = resource<FAQResponse, { category?: string }>({
    params: () => ({ category: this.selectedCategory() || undefined }),
    loader: async ({ params }) => {
      const res = await this.helpFaqService.getFAQs(params.category);
      return res ?? { items: [], total: 0, page: 1, limit: 50 };
    },
    defaultValue: { items: [], total: 0, page: 1, limit: 50 },
  });

  constructor() {
    this.loadCategories();
  }

  private async loadCategories(): Promise<void> {
    try {
      const cats = await this.helpFaqService.getCategories();
      this.categories.set(cats ?? []);
    } catch {
      // fallback
    }
  }
}
