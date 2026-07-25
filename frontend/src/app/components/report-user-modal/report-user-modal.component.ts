import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafetyService, ReportUserDto } from '../../services/safety.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (show) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        (click)="onBackdropClick($event)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <!-- Modal content -->
        <div
          class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <h2
            id="report-modal-title"
            class="mb-4 text-xl font-bold text-gray-900 dark:text-white"
          >
            Report user
          </h2>

          <!-- Form (template driven) -->
          <form (ngSubmit)="submit()" #reportForm="ngForm">
            <!-- Reason category -->
            <div class="mb-4">
              <label
                for="reason"
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Reason *
              </label>
              <select
                id="reason"
                name="reason"
                [(ngModel)]="reasonCategory"
                required
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-500"
              >
                <option value="" disabled>Select a reason</option>
                <option value="harassment">Harassment</option>
                <option value="spam">Spam</option>
                <option value="impersonation">Impersonation</option>
                <option value="inappropriate_content">Inappropriate content</option>
                <option value="other">Other</option>
              </select>
            </div>

            <!-- Description -->
            <div class="mb-4">
              <label
                for="description"
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Details (optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows="3"
                [(ngModel)]="description"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-500"
                placeholder="Describe the problem..."
              ></textarea>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-3">
              <button
                type="button"
                (click)="cancel()"
                class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="!reportForm.valid || submitting"
                class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                @if (submitting) {
                  Submitting...
                } @else {
                  Submit report
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class ReportUserModalComponent {
  @Input() reportUserId!: string;
  @Input() show: boolean = false;
  @Input() contextUrl?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  reasonCategory: string = '';
  description: string = '';
  submitting: boolean = false;

  private readonly safetyService = inject(SafetyService);

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }

  cancel(): void {
    this.resetForm();
    this.closed.emit();
  }

  submit(): void {
    if (this.submitting || !this.reportUserId || !this.reasonCategory) {
      return;
    }
    this.submitting = true;

    const dto: ReportUserDto = {
      reported_id: this.reportUserId,
      reason_category: this.reasonCategory,
      description: this.description || undefined,
      context_url: this.contextUrl || undefined,
    };

    this.safetyService.reportUser(dto).subscribe({
      next: () => {
        this.submitting = false;
        this.resetForm();
        this.submitted.emit();
        this.closed.emit();
      },
      error: (err) => {
        this.submitting = false;
        console.error('Report submission failed:', err);
      },
    });
  }

  private resetForm(): void {
    this.reasonCategory = '';
    this.description = '';
    this.submitting = false;
  }
}
