import { Component, input, output, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SafetyService, ReportCategory } from '../../services/safety.service';
import { ToastService } from '../primitives/toast/toast.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      (click)="close.emit()"
    >
      <!-- Modal dialog -->
      <div
        class="w-full max-w-md rounded-3xl bg-slate-800 p-6 shadow-2xl border border-slate-700"
        (click)="$event.stopPropagation()"
      >
        <h2 class="mb-6 text-2xl font-bold text-white text-center">Report User</h2>

        @if (isLoadingCategories()) {
          <div class="mb-6 flex items-center justify-center gap-2 text-sm text-slate-400">
            <svg class="h-5 w-5 animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading categories…
          </div>
        } @else {
          <!-- Category selection pills -->
          <div class="mb-6 flex flex-wrap gap-2">
            @for (cat of categories(); track cat.value) {
              <button
                type="button"
                class="rounded-full px-4 py-1.5 text-sm font-semibold transition
                  {{
                    selectedCategory() === cat.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700/50 text-slate-200 hover:bg-slate-700'
                  }}"
                (click)="selectedCategory.set(cat.value)"
              >
                {{ cat.label }}
              </button>
            }
          </div>
        }

        <!-- Optional description (only after category selection) -->
        @if (selectedCategory()) {
          <div class="mb-6">
            <label for="report-description" class="mb-2 block text-sm font-medium text-slate-300">
              Additional details (optional)
            </label>
            <textarea
              id="report-description"
              [(ngModel)]="description"
              rows="3"
              maxlength="500"
              class="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white
                placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1
                focus:ring-purple-500"
              placeholder="Provide more context…"
            ></textarea>
          </div>
        }

        <!-- Action buttons -->
        <div class="flex justify-end gap-3">
          <button
            class="rounded-full px-6 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
            (click)="close.emit()"
          >
            Cancel
          </button>
          <button
            class="rounded-full px-6 py-2.5 text-sm font-semibold bg-purple-600 text-white hover:bg-purple-500
              disabled:opacity-50 disabled:cursor-not-allowed transition"
            [disabled]="!selectedCategory() || isSubmitting()"
            (click)="submitReport()"
          >
            {{ isSubmitting() ? 'Submitting…' : 'Submit Report' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ReportUserModalComponent implements OnInit {
  readonly reportedUserId = input.required<string>();
  readonly contextUrl = input('');

  readonly close = output<void>();
  readonly submitted = output<void>();

  private readonly safetyService = inject(SafetyService);
  private readonly toastService = inject(ToastService);

  categories = signal<ReportCategory[]>([]);
  isLoadingCategories = signal(true);
  selectedCategory = signal<string | null>(null);
  isSubmitting = signal(false);
  description = '';

  ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.isLoadingCategories.set(true);
    this.safetyService.getReportCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats.length > 0 ? cats : this.getStaticCategories());
        this.isLoadingCategories.set(false);
      },
      error: () => {
        this.categories.set(this.getStaticCategories());
        this.isLoadingCategories.set(false);
      },
    });
  }

  private getStaticCategories(): ReportCategory[] {
    return [
      { value: 'harassment', label: 'Harassment', icon: '🚫', description: '' },
      { value: 'spam', label: 'Spam', icon: '📧', description: '' },
      { value: 'inappropriate_content', label: 'Inappropriate Content', icon: '🔞', description: '' },
      { value: 'impersonation', label: 'Impersonation', icon: '🎭', description: '' },
      { value: 'underage', label: 'Underage User', icon: '👶', description: '' },
      { value: 'other', label: 'Other', icon: '📝', description: '' },
    ];
  }

  submitReport(): void {
    const category = this.selectedCategory();
    if (!category || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    const dto = {
      reported_id: this.reportedUserId(),
      reason_category: category,
      description: this.description.trim() || undefined,
      context_url: this.contextUrl() || window.location.href,
    };

    this.safetyService.reportUser(dto).subscribe({
      next: () => {
        this.toastService.show('Report submitted. We will review it shortly.', { type: 'success' });
        this.submitted.emit();
        this.isSubmitting.set(false);
        this.close.emit();
      },
      error: (err) => {
        console.error('Report failed', err);
        this.toastService.show('Failed to submit report. Please try again.', { type: 'error' });
        this.isSubmitting.set(false);
      },
    });
  }
}
