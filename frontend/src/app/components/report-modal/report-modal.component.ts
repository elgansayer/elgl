import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SafetyService } from '../../services/safety.service';
import { ToastService } from '../primitives/toast/toast.service';
import { ReportUserDto } from '../../services/safety.service';
import { I18nService } from '../../services/i18n.service';

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
          {{ modalTitle }}
        </h2>

        <label class="block text-sm text-slate-400 mb-1">
          {{ reasonLabel }}
        </label>
        <select
          [(ngModel)]="selectedReason"
          class="w-full p-2 rounded bg-slate-700 text-white border border-slate-600 mb-4"
        >
          <option value="" disabled hidden>
            {{ selectReasonLabel }}
          </option>
          <option value="harassment">
            {{ harassmentLabel }}
          </option>
          <option value="spam">
            {{ spamLabel }}
          </option>
          <option value="inappropriate_content">
            {{ inappropriateLabel }}
          </option>
          <option value="fake_profile">
            {{ fakeProfileLabel }}
          </option>
          <option value="other">
            {{ otherLabel }}
          </option>
        </select>

        <label class="block text-sm text-slate-400 mb-1">
          {{ descriptionOptionalLabel }}
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
            {{ cancelLabel }}
          </button>
          <button
            (click)="onSubmit()"
            [disabled]="!isValid"
            class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
          >
            {{ submitLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ReportModalComponent implements OnInit {
  @Input() targetUserId!: string;
  @Input() contextUrl?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  selectedReason = '';
  description = '';

  private readonly safetyService = inject(SafetyService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  // Translated labels (populated in ngOnInit)
  modalTitle = '';
  reasonLabel = '';
  selectReasonLabel = '';
  harassmentLabel = '';
  spamLabel = '';
  fakeProfileLabel = '';
  inappropriateLabel = '';
  otherLabel = '';
  descriptionOptionalLabel = '';
  cancelLabel = '';
  submitLabel = '';

  ngOnInit(): void {
    this.modalTitle = this.i18n.translate('report.modal_title');
    this.reasonLabel = this.i18n.translate('report.reason');
    this.selectReasonLabel = this.i18n.translate('report.select_reason');
    this.harassmentLabel = this.i18n.translate('report.harassment');
    this.spamLabel = this.i18n.translate('report.spam');
    this.fakeProfileLabel = this.i18n.translate('report.fake_profile');
    this.inappropriateLabel = this.i18n.translate('report.inappropriate');
    this.otherLabel = this.i18n.translate('report.other');
    this.descriptionOptionalLabel = this.i18n.translate('report.description_optional');
    this.cancelLabel = this.i18n.translate('common.cancel');
    this.submitLabel = this.i18n.translate('report.submit');
  }

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
        this.toast.show('report.success', { type: 'success' });
        this.submitted.emit();
      },
      error: () => {
        this.toast.show('report.error', { type: 'error' });
      },
    });
  }
}
