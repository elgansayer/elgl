import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafetyService, ReportUserDto } from '../../services/safety.service';

export interface ReportCategory {
  value: string;
  label: string;
}

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-modal.component.html',
  styleUrls: ['./report-modal.component.css'],
})
export class ReportModalComponent {
  private safetyService = inject(SafetyService);

  /** The ID of the user being reported */
  reportedUserId = input.required<string>();

  /** Emitted when the modal should be closed (success or cancel) */
  close = output<void>();

  /** Emitted after a successful report */
  reported = output<void>();

  categories: ReportCategory[] = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'fake_profile', label: 'Fake Profile' },
    { value: 'other', label: 'Other' },
  ];

  selectedCategory = '';
  description = '';
  isSubmitting = false;
  errorMessage = '';

  get canSubmit(): boolean {
    return this.selectedCategory !== '' && !this.isSubmitting;
  }

  submitReport(): void {
    if (!this.canSubmit) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    const dto: ReportUserDto = {
      reported_id: this.reportedUserId(),
      reason_category: this.selectedCategory,
      description: this.description || undefined,
    };

    this.safetyService.reportUser(dto).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.reported.emit();
        this.close.emit();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Failed to submit report. Please try again.';
      },
    });
  }

  cancel(): void {
    this.close.emit();
  }
}
