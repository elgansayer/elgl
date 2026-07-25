import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SafetyService, ReportUserDto } from '../../services/safety.service';
import { ToastService } from '../../components/primitives/toast/toast.service'; // adjust path

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      (click)="close.emit()"
    >
      <div
        class="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-labelledby="report-dialog-title"
      >
        <h2 id="report-dialog-title" class="text-xl font-bold text-white mb-4">
          Report User
        </h2>

        <form [formGroup]="reportForm" (ngSubmit)="submitReport()">
          <!-- Reason -->
          <div class="mb-4">
            <label class="block text-slate-300 text-sm mb-1" for="reason">Reason *</label>
            <select
              id="reason"
              formControlName="reason_category"
              class="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="" disabled>Select a reason</option>
              <option value="harassment">Harassment</option>
              <option value="spam">Spam</option>
              <option value="inappropriate_content">Inappropriate Content</option>
              <option value="impersonation">Impersonation</option>
              <option value="other">Other</option>
            </select>
            <div
              *ngIf="reportForm.get('reason_category')?.invalid && reportForm.get('reason_category')?.touched"
              class="text-red-400 text-xs mt-1"
            >
              Reason is required.
            </div>
          </div>

          <!-- Description -->
          <div class="mb-4">
            <label class="block text-slate-300 text-sm mb-1" for="description">
              Description (optional)
            </label>
            <textarea
              id="description"
              formControlName="description"
              rows="3"
              class="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Add details to help us investigate..."
            ></textarea>
          </div>

          <!-- Block toggle -->
          <div class="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="blockUser"
              formControlName="block_user"
              class="rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500"
            />
            <label for="blockUser" class="text-slate-300 text-sm">
              Also block this user
            </label>
          </div>

          <!-- Error message -->
          @if (errorMessage) {
            <div class="mb-4 p-2 bg-red-600/20 border border-red-500 rounded text-red-200 text-sm">
              {{ errorMessage }}
            </div>
          }

          <!-- Buttons -->
          <div class="flex justify-end gap-3 mt-6">
            <button
              type="button"
              class="px-4 py-2 rounded bg-slate-600 text-white hover:bg-slate-500 transition-colors"
              (click)="close.emit()"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              [disabled]="reportForm.invalid || isSubmitting"
            >
              @if (isSubmitting) {
                <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Submitting...
              } @else {
                Submit Report
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class ReportUserModalComponent {
  @Input({ required: true }) reportUserId!: string;
  @Input() contextUrl?: string;
  @Output() close = new EventEmitter<void>();
  @Output() reported = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private safetyService = inject(SafetyService);
  private toastService = inject(ToastService);

  isSubmitting = false;
  errorMessage = '';

  reportForm = this.fb.group({
    reason_category: ['', Validators.required],
    description: [''],
    block_user: [false]
  });

  submitReport() {
    if (this.reportForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    const formValue = this.reportForm.value;
    const dto: ReportUserDto & { block_user?: boolean } = {
      reported_id: this.reportUserId,
      reason_category: formValue.reason_category!,
      description: formValue.description || undefined,
      context_url: this.contextUrl,
      block_user: formValue.block_user ?? false
    };

    // Execute report first, then block if requested
    this.safetyService.reportUser({
      reported_id: dto.reported_id,
      reason_category: dto.reason_category,
      description: dto.description,
      context_url: dto.context_url
    }).subscribe({
      next: async () => {
        if (dto.block_user) {
          try {
            await this.safetyService.blockUserAsync(dto.reported_id);
          } catch (blockErr) {
            // Block failed but report succeeded – show a warning
            this.toastService.show(
              'Report submitted, but blocking failed. Please block manually from settings.'
            );
            this.isSubmitting = false;
            this.reported.emit();
            return;
          }
        }
        this.toastService.show('Report submitted successfully');
        this.isSubmitting = false;
        this.reported.emit();
        this.close.emit();
      },
      error: (err) => {
        this.errorMessage = err?.message || 'Failed to submit report. Please try again.';
        this.isSubmitting = false;
      }
    });
  }
}
