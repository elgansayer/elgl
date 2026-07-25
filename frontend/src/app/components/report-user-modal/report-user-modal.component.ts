import { Component, input, output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SafetyService } from '../../services/safety.service';
import { ToastService } from '../../components/primitives/toast/toast.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <!-- Modal container -->
      <div class="w-full max-w-md rounded-3xl bg-slate-800 p-6 shadow-2xl border border-slate-700"
           (click)="$event.stopPropagation()">
        <h2 class="mb-6 text-2xl font-bold text-white text-center">Report User</h2>

        <!-- Category selection -->
        <div class="mb-6 space-y-3">
          @for (cat of categories; track cat.value) {
            <button
              type="button"
              class="w-full rounded-xl px-4 py-3 text-start transition-all duration-200 text-white border"
              [class.bg-blue-600]="selectedCategory() === cat.value"
              [class.border-blue-400]="selectedCategory() === cat.value"
              [class.bg-slate-700]="selectedCategory() !== cat.value"
              [class.border-slate-600]="selectedCategory() !== cat.value"
              (click)="selectCategory(cat.value)">
              <span class="font-semibold">{{ cat.label }}</span>
              @if (selectedCategory() === cat.value) {
                <span class="float-end text-blue-200 text-sm">✓</span>
              }
            </button>
          }
        </div>

        <!-- Description field (shown after category selection) -->
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
              class="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Provide more context…"
            ></textarea>
          </div>
        }

        <!-- Action buttons -->
        <div class="flex justify-end gap-3">
          <button
            class="rounded-full px-6 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            (click)="closeModal()">
            Cancel
          </button>
          <button
            class="rounded-full px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="!selectedCategory() || isSubmitting()"
            (click)="submitReport()">
            {{ isSubmitting() ? 'Submitting…' : 'Submit Report' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ReportUserModalComponent {
  readonly reportedUserId = input.required<string>();
  readonly contextUrl = input<string>('');
  readonly close = output<void>();
  readonly reported = output<void>();

  private readonly safetyService = inject(SafetyService);
  private readonly toastService = inject(ToastService);

  readonly categories = [
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'spam', label: 'Spam or advertising' },
    { value: 'inappropriate_content', label: 'Inappropriate content' },
    { value: 'fake_profile', label: 'Fake profile' },
    { value: 'underage', label: 'Underage user' },
    { value: 'other', label: 'Other' },
  ];

  selectedCategory = signal<string | null>(null);
  description = '';
  isSubmitting = signal(false);

  selectCategory(cat: string) {
    this.selectedCategory.set(cat);
  }

  closeModal() {
    this.selectedCategory.set(null);
    this.description = '';
    this.close.emit();
  }

  submitReport() {
    const cat = this.selectedCategory();
    if (!cat || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    const dto = {
      reported_id: this.reportedUserId(),
      reason_category: cat,
      description: this.description || undefined,
      context_url: this.contextUrl() || window.location.href,
    };

    this.safetyService.reportUser(dto).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.reported.emit();
        this.toastService.show('Report submitted. We will review it shortly.', { type: 'success' });
      },
      error: (err) => {
        console.error('Report failed', err);
        this.isSubmitting.set(false);
        this.toastService.show('Failed to submit report. Please try again.', { type: 'error' });
      },
    });
  }
}
