import { Component, Input, Output, EventEmitter, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { SafetyService, ReportUserDto } from '../../../services/safety.service';

const REPORT_CATEGORIES = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
];

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './report-user-modal.component.html',
  styleUrls: ['./report-user-modal.component.scss'],
})
export class ReportUserModalComponent {
  private safetyService = inject(SafetyService);

  @Input() visible = false;
  @Input() reportedUserId = '';
  @Input() reportedUserName?: string;
  @Input() contextUrl?: string;

  @Output() closeModal = new EventEmitter<void>();
  @Output() reportSuccess = new EventEmitter<void>();

  categories = REPORT_CATEGORIES;
  selectedCategory = '';
  description = '';
  submitting = false;
  errorMessage = '';

  reset() {
    this.selectedCategory = '';
    this.description = '';
    this.submitting = false;
    this.errorMessage = '';
  }

  submitReport() {
    if (!this.selectedCategory) {
      this.errorMessage = 'Please select a reason.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    const dto: ReportUserDto = {
      reported_id: this.reportedUserId,
      reason_category: this.selectedCategory,
      description: this.description || undefined,
      context_url: this.contextUrl || undefined,
    };

    this.safetyService.reportUser(dto).subscribe({
      next: () => {
        this.submitting = false;
        this.reset();
        this.reportSuccess.emit();
        this.closeModal.emit();
      },
      error: () => {
        this.submitting = false;
        this.errorMessage = 'Failed to submit report. Please try again.';
      },
    });
  }

  cancel() {
    this.reset();
    this.closeModal.emit();
  }
}
