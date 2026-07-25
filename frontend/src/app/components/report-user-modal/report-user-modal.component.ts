import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SafetyService } from '../../services/safety.service';
import { ToastService } from '../../components/primitives/toast/toast.service';
import type { ReportUserDto } from '../../services/safety.service';

@Component({
  selector: 'app-report-user-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-user-modal.component.html',
  styleUrls: ['./report-user-modal.component.scss']
})
export class ReportUserModalComponent {
  // Inputs
  readonly reportedUserId = input.required<string>();
  readonly contextUrl = input<string>('');
  readonly show = input.required<boolean>();

  // Outputs
  readonly closed = output<void>();
  readonly reportSent = output<void>();

  // Static categories matching the backend DTO
  readonly reasonCategories = [
    { value: 'harassment', label: 'Harassment' },
    { value: 'spam', label: 'Spam' },
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'underage', label: 'Underage User' },
    { value: 'impersonation', label: 'Impersonation' },
    { value: 'other', label: 'Other' }
  ] as const;

  readonly selectedCategory = signal<string | null>(null);
  readonly description = signal<string>('');

  readonly submitting = signal(false);

  constructor(
    private readonly safetyService: SafetyService,
    private readonly toast: ToastService
  ) {}

  cancel() {
    this.closed.emit();
  }

  async submitReport() {
    if (!this.selectedCategory()) return;

    this.submitting.set(true);
    try {
      const payload: ReportUserDto = {
        reported_id: this.reportedUserId(),
        reason_category: this.selectedCategory()!,
        description: this.description() || undefined,
        context_url: this.contextUrl() || undefined
      };
      await firstValueFrom(this.safetyService.reportUser(payload));
      this.reportSent.emit();
      this.toast.show('Report submitted successfully', { type: 'success' });
    } catch (error) {
      this.toast.show('Failed to submit report', { type: 'error' });
    } finally {
      this.submitting.set(false);
      this.closed.emit();
    }
  }
}
