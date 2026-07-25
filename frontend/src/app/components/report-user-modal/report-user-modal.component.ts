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
      <div class="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm"
           (click)="cancel()">
        <!-- Bottom Sheet -->
        <div class="bg-slate-800 rounded-t-2xl shadow-2xl w-full max-w-md mx-auto px-5 pt-5 pb-safe"
             (click)="$event.stopPropagation()">
          <!-- Drag handle (optional visual) -->
          <div class="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4"></div>

          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
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
          <p class="text-sm text-slate-300 mb-3">Hey, why are you reporting this user?</p>

          <!-- Loading state -->
          @if (loadingCategories()) {
            <div class="flex items-center justify-center py-4">
              <span class="animate-spin h-5 w-5 border-2 border-slate-400 border-t-transparent rounded-full"></span>
              <span class="ms-2 text-slate-400">Loading categories...</span>
            </div>
          }

          <!-- Error state -->
          @if (loadError() && !loadingCategories()) {
            <div class="text-red-400 text-sm bg-red-900/30 border border-red-500/40 rounded-lg p-3 mb-3">
              Could not load categories. Using fallback list.
              @if (staticCategories().length) {
                <button type="button" class="ms-2 underline" (click)="retryLoadCategories()">Retry</button>
              }
            </div>
          }

          <!-- Category tiles (grid of 2 columns) -->
          @if (!loadingCategories() && categoriesToShow().length) {
            <div class="grid grid-cols-2 gap-2 mb-4 max-h-64 overflow-y-auto pr-1">
              @for (cat of categoriesToShow(); track cat.value) {
                <button
                  class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center"
                  [ngClass]="{
                    'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-400': selectedCategory() === cat.value,
                    'border-slate-600 hover:border-slate-500': selectedCategory() !== cat.value
                  }"
                  (click)="selectCategory(cat.value)"
                >
                  @if (cat.icon) {
                    <span class="text-2xl mb-1">{{ cat.icon }}</span>
                  }
                  <span class="text-xs font-medium text-slate-200 leading-tight">{{ cat.label }}</span>
                </button>
              }
            </div>
          } @else if (!loadingCategories() && !loadError()) {
            <div class="text-slate-400 text-sm text-center py-4">No categories available.</div>
          }

          <!-- Optional description -->
          <div class="mb-3">
            <label class="block text-sm text-slate-300 mb-1">Additional details (optional)</label>
            <textarea
              [(ngModel)]="description"
              rows="3"
              maxlength="500"
              class="w-full rounded-lg border border-slate-600 bg-slate-900 text-slate-100 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Provide any context, such as what they said or did..."
            ></textarea>
            <div class="text-xs text-slate-500 text-end mt-1">{{ description().length }}/500</div>
          </div>

          <!-- Block user toggle -->
          <label class="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" [(ngModel)]="blockUser" class="form-checkbox h-4 w-4 text-indigo-500 rounded border-slate-500 bg-slate-700 focus:ring-indigo-500" />
            <span class="text-sm text-slate-300">Block this user (prevents future contact)</span>
          </label>

          <!-- Footer buttons -->
          <div class="flex gap-2 pb-4">
            <button
              type="button"
              class="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
              (click)="cancel()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    /* Ensure bottom sheet appears above all content on small screens */
    @media (max-width: 640px) {
      .mx-auto { margin-left: auto; margin-right: auto; }
    }
  `]
})
export class ReportUserModalComponent implements OnInit {
  private readonly safetyService = inject(SafetyService);
  private readonly toast = inject(ToastService);

  readonly reportedUserId = input.required<string>();
  readonly contextUrl    = input<string>('');
  readonly show          = input.required<boolean>();

  readonly close         = output<void>();
  readonly reported      = output<void>();

  readonly selectedCategory = signal<string | null>(null);
  readonly description      = signal<string>('');
  readonly submitting       = signal(false);
  readonly blockUser        = signal(false);

  categories = signal<ReportCategory[]>([]);
  loadingCategories = signal(false);
  loadError = signal(false);

  staticCategories = computed(() => this.safetyService.getStaticReportCategories());

  categoriesToShow = computed(() => {
    if (this.loadError() || this.categories().length === 0) {
      return this.staticCategories();
    }
    return this.categories();
  });

  ngOnInit(): void {
    this.resetForm();
    this.loadCategories();
  }

  private resetForm(): void {
    this.selectedCategory.set(null);
    this.description.set('');
    this.blockUser.set(false);
  }

  selectCategory(value: string): void {
    this.selectedCategory.set(value);
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
      const requests: Promise<any>[] = [lastValueFrom(this.safetyService.reportUser(payload))];

      if (this.blockUser()) {
        requests.push(lastValueFrom(this.safetyService.blockUser(this.reportedUserId())));
      }

      await Promise.all(requests);

      this.toast.show(
        this.blockUser()
          ? 'Report submitted & user blocked'
          : 'Report submitted successfully',
        { type: 'success' }
      );
      this.reported.emit();
      this.close.emit();
    } catch {
      this.toast.show('Failed to submit report', { type: 'error' });
    } finally {
      this.submitting.set(false);
    }
  }
}
