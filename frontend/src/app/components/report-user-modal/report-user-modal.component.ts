import { Component, input, output, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SafetyService, ReportCategory } from '../../services/safety.service';
import { ToastService } from '../../components/primitives/toast/toast.service';
import type { ReportUserDto } from '../../services/safety.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (show()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold text-slate-100">Report User</h2>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-200 text-2xl leading-none p-1"
              (click)="cancel()"
            >
              &times;
            </button>
          </div>

          <!-- Body -->
          <div class="p-4 space-y-4">
            <p class="text-sm text-slate-300">Why are you reporting this user?</p>

            <!-- Loading state -->
            @if (loadingCategories()) {
              <div class="flex items-center justify-center py-4">
                <span class="animate-spin h-5 w-5 border-2 border-slate-400 border-t-transparent rounded-full"></span>
                <span class="ms-2 text-slate-400">Loading categories...</span>
              </div>
            }

            <!-- Error state -->
            @if (loadError() && !loadingCategories()) {
              <div class="text-red-400 text-sm bg-red-900/30 border border-red-500/40 rounded-lg p-3">
                Could not load categories. Using fallback list.
                @if (staticCategories().length) {
                  <button type="button" class="ms-2 underline" (click)="retryLoadCategories()">Retry</button>
                }
              </div>
            }

            <!-- Category list (radio group) -->
            @if (!loadingCategories() && categoriesToShow().length) {
              <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
                @for (cat of categoriesToShow(); track cat.value) {
                  <label
                    class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all"
                    [ngClass]="{
                      'border-blue-500 bg-blue-500/10': selectedCategory() === cat.value,
                      'border-slate-600 hover:border-slate-500': selectedCategory() !== cat.value
                    }"
                  >
                    <input
                      type="radio"
                      name="reportCategory"
                      [value]="cat.value"
                      [(ngModel)]="selectedCategory"
                      class="form-radio text-blue-500 focus:ring-blue-500"
                    />
                    <div>
                      <div class="text-sm font-medium text-slate-200">
                        @if (cat.icon) {
                          <span class="me-1.5">{{ cat.icon }}</span>
                        }
                        {{ cat.label }}
                      </div>
                      @if (cat.description) {
                        <div class="text-xs text-slate-400 mt-0.5">{{ cat.description }}</div>
                      }
                    </div>
                  </label>
                }
              </div>
            } @else if (!loadingCategories() && !loadError()) {
              <div class="text-slate-400 text-sm text-center py-4">No categories available.</div>
            }

            <!-- Optional description -->
            <div>
              <label class="block text-sm text-slate-300 mb-1">Additional details (optional)</label>
              <textarea
                [(ngModel)]="description"
                rows="3"
                maxlength="500"
                class="w-full rounded-lg border border-slate-600 bg-slate-900 text-slate-100 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Provide any context, such as what they said or did..."
              ></textarea>
              <div class="text-xs text-slate-500 text-end mt-1">{{ description().length }}/500</div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-2 p-4 border-t border-slate-700">
            <button
              type="button"
              class="px-4 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
              (click)="cancel()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              [disabled]="!selectedCategory() || submitting()"
              (click)="submitReport()"
            >
              @if (submitting()) {
                <span class="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full me-1 align-middle"></span>
              }
              Submit Report
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class ReportUserModalComponent implements OnInit {
  private readonly safetyService = inject(SafetyService);
  private readonly toast = inject(ToastService);

  // Inputs / Outputs (signal-friendly, as originally designed)
  readonly reportedUserId = input.required<string>();
  readonly contextUrl    = input<string>('');
  readonly show          = input.required<boolean>();

  readonly close         = output<void>();
  readonly reported      = output<void>();

  // UI state
  readonly selectedCategory = signal<string | null>(null);
  readonly description      = signal<string>('');
  readonly submitting       = signal(false);

  // Dynamic categories (loaded from backend)
  categories = signal<ReportCategory[]>([]);
  loadingCategories = signal(false);
  loadError = signal(false);

  // Static fallback categories (retrieve from service)
  staticCategories = computed(() => this.safetyService.getStaticReportCategories());

  // Categories to display: dynamic if loaded, else static fallback on error
  categoriesToShow = computed(() => {
    if (this.loadError() || this.categories().length === 0) {
      return this.staticCategories();
    }
    return this.categories();
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  private async loadCategories(): Promise<void> {
    this.loadingCategories.set(true);
    this.loadError.set(false);
    try {
      const cats = await lastValueFrom(
        this.safetyService.getCategories().pipe(
          catchError(() => of(this.safetyService.getStaticReportCategories()))
        )
      );
      this.categories.set(cats);
      // If no categories returned, treat as error to show fallback
      if (cats.length === 0) {
        this.loadError.set(true);
      }
    } catch {
      this.loadError.set(true);
    } finally {
      this.loadingCategories.set(false);
    }
  }

  retryLoadCategories(): void {
    this.loadCategories();
  }

  cancel(): void {
    this.close.emit();
  }

  async submitReport(): Promise<void> {
    if (!this.selectedCategory()) return;
    this.submitting.set(true);
    try {
      const payload: ReportUserDto = {
        reported_id: this.reportedUserId(),
        reason_category: this.selectedCategory()!,
        description: this.description().trim() || undefined,
        context_url: this.contextUrl() || undefined
      };
      await lastValueFrom(this.safetyService.reportUser(payload));
      this.toast.show('Report submitted successfully', { type: 'success' });
      this.reported.emit();
    } catch {
      this.toast.show('Failed to submit report', { type: 'error' });
    } finally {
      this.submitting.set(false);
      this.close.emit();
    }
  }
}
