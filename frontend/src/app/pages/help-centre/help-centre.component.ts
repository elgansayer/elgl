import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
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
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
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
export class HelpCentreComponent implements OnInit {
  private readonly baseUrl = `${environment.apiUrl}/help/articles`;

  // State
  loading = signal(false);
  error = signal<string | null>(null);

  articles = signal<FAQ[]>([]);
  total = signal(0);
  page = signal(1);
  limit = signal(10);

  // Filters
  selectedCategory = signal('');
  searchText = '';

  // Pagination helpers
  totalPages = computed(() => Math.ceil(this.total() / this.limit()) || 1);
  hasPrevious = computed(() => this.page() > 1);
  hasNext = computed(() => this.page() < this.totalPages());

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.loadArticles();
  }

  loadArticles(): void {
    this.loading.set(true);
    this.error.set(null);

    const params: Record<string, string | number> = {
      page: this.page(),
      limit: this.limit(),
    };
    if (this.selectedCategory()) {
      params['category'] = this.selectedCategory();
    }
    if (this.searchText) {
      params['search'] = this.searchText;
    }

    this.http.get<HelpResponse>(this.baseUrl, { params }).subscribe({
      next: (res) => {
        this.articles.set(res.items);
        this.total.set(res.total);
        this.page.set(res.page);
        this.limit.set(res.limit);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Failed to load help articles. Please try again.');
        this.loading.set(false);
      },
    });
  }

  applyCategory(category: string): void {
    this.selectedCategory.set(category);
    this.page.set(1);
    this.loadArticles();
  }

  applySearch(): void {
    this.page.set(1);
    this.loadArticles();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    this.loadArticles();
  }
}
