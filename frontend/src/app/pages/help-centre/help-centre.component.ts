import { Component, signal, computed, inject, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

interface HelpResponse {
  items: FAQ[];
  total: number;
  page: number;
  limit: number;
}

@Component({
  selector: 'app-help-centre',
  imports: [FormsModule],
  templateUrl: './help-centre.component.html',
  styles: [
    `
      .faq-item {
        border-bottom: 1px solid #e5e7eb;
        padding: 1rem 0;
      }
      .faq-category {
        text-transform: uppercase;
        font-size: 0.75rem;
        color: #6b7280;
        margin-bottom: 0.25rem;
      }
    `,
  ],
})
export class HelpCentreComponent {
  private readonly baseUrl = `${environment.apiUrl}/help/articles`;

  loading = signal(false);
  error = signal<string | null>(null);

  articles = signal<FAQ[]>([]);
  total = signal(0);
  page = signal(1);
  limit = signal(10);

  selectedCategory = signal('');
  searchText = '';
  private searchSignal = signal('');

  totalPages = computed(() => Math.ceil(this.total() / this.limit()) || 1);
  hasPrevious = computed(() => this.page() > 1);
  hasNext = computed(() => this.page() < this.totalPages());

  private http = inject(HttpClient);

  private articlesLoader = resource({
    params: () => ({
      page: this.page(),
      limit: this.limit(),
      category: this.selectedCategory(),
      search: this.searchSignal(),
    }),
    loader: async ({ params }) => {
      this.loading.set(true);
      this.error.set(null);

      const queryParams: Record<string, string | number> = {
        page: params.page,
        limit: params.limit,
      };
      if (params.category) queryParams['category'] = params.category;
      if (params.search) queryParams['search'] = params.search;

      try {
        const res = await firstValueFrom(
          this.http.get<HelpResponse>(this.baseUrl, { params: queryParams }),
        );
        this.articles.set(res.items);
        this.total.set(res.total);
        this.page.set(res.page);
        this.limit.set(res.limit);
        return res;
      } catch (err) {
        console.error(err);
        this.error.set('Failed to load help articles. Please try again.');
        return null;
      } finally {
        this.loading.set(false);
      }
    },
  });

  applyCategory(category: string): void {
    this.selectedCategory.set(category);
    this.page.set(1);
  }

  applySearch(): void {
    this.searchSignal.set(this.searchText);
    this.page.set(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
  }
}
