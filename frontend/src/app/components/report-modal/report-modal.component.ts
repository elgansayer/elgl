import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SafetyService } from '../../services/safety.service';
import { ToastService } from '../primitives/toast/toast.service';
import { ReportUserDto } from '../../services/safety.service';

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      (click)="onBackdropClick($event)"
    >
      <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4">
        <h2 class="text-xl font-bold text-white mb-4">
          {{ 'report.modal_title' | translate }}
        </h2>

        <label class="block text-sm text-slate-400 mb-1">
          {{ 'report.reason' | translate }}
        </label>
        <select
          [(ngModel)]="selectedReason"
          class="w-full p-2 rounded bg-slate-700 text-white border border-slate-600 mb-4"
        >
          <option value="" disabled hidden>
            {{ 'report.select_reason' | translate }}
          </option>
          <option value="harassment">
            {{ 'report.harassment' | translate }}
          </option>
          <option value="spam">
            {{ 'report.spam' | translate }}
          </option>
          <option value="impersonation">
            {{ 'report.impersonation' | translate }}
          </option>
          <option value="inappropriate_content">
            {{ 'report.inappropriate' | translate }}
          </option>
          <option value="other">
            {{ 'report.other' | translate }}
          </option>
        </select>

        <label class="block text-sm text-slate-400 mb-1">
          {{ 'report.description_optional' | translate }}
        </label>
        <textarea
          [(ngModel)]="description"
          rows="3"
          class="w-full p-2 rounded bg-slate-700 text-white border border-slate-600 mb-6"
        ></textarea>

        <div class="flex justify-end gap-3">
          <button
            (click)="onCancel()"
            class="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
          >
            {{ 'common.cancel' | translate }}
          </button>
          <button
            (click)="onSubmit()"
            [disabled]="!isValid"
            class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
          >
            {{ 'report.submit' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ReportModalComponent {
  @Input() targetUserId!: string;
  @Input() contextUrl?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  selectedReason = '';
  description = '';

  constructor(
    private readonly safetyService: SafetyService,
    private readonly toast: ToastService,
  ) {}

  get isValid(): boolean {
    return this.targetUserId != null && this.selectedReason.length > 0;
  }

  onCancel(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.onCancel();
    }
  }

  onSubmit(): void {
    if (!this.isValid) return;

    const dto: ReportUserDto = {
      reported_id: this.targetUserId,
      reason_category: this.selectedReason,
      description: this.description || undefined,
      context_url: this.contextUrl,
    };

    this.safetyService.reportUser(dto).subscribe({
      next: () => {
        this.toast.show('report.success', 'success');
        this.submitted.emit();
      },
      error: () => {
        this.toast.show('report.error', 'error');
      },
    });
  }
}
