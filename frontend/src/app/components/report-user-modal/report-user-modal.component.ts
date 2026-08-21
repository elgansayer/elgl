import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { Component, computed, inject, output, signal } from '@angular/core';
import { form, required, FormField } from '@angular/forms/signals';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { SafetyService, ReportCategory, ReportUserDto } from '../../services/safety.service';
import { showToast } from '../../services/toast.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

interface ReportFormModel {
  category: string;
  description: string;
  blockUser: boolean;
}

@Component({
  selector: 'app-report-user-modal',
  imports: [
    HlmCheckbox,
    HlmTextarea,
    FormField,
    TranslatePipe,
    ...HlmRadioGroupImports,
    ...HlmButtonImports,
    ...HlmDialogImports,
  ],
  templateUrl: './report-user-modal.component.html',
})
export class ReportUserModalComponent {
  readonly modalClosed = output<void>();
  readonly reported = output<void>();

  private readonly safetyService = inject(SafetyService);
  private readonly i18n = inject(I18nService);

  readonly isOpen = signal(false);
  readonly dialogState = computed<HlmDialogState>(() => (this.isOpen() ? 'open' : 'closed'));
  readonly titleId = 'report-user-modal-title';

  private readonly reportUserId = signal('');
  private readonly contextUrl = signal<string | undefined>(undefined);

  readonly loadingCategories = signal(false);
  readonly loadError = signal(false);
  readonly categories = signal<ReportCategory[]>([]);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly formModel = signal<ReportFormModel>({
    category: '',
    description: '',
    blockUser: false,
  });
  readonly reportForm = form(this.formModel, (p) => {
    required(p.category);
  });

  readonly canSubmit = computed(() => this.reportForm().valid() && !this.isSubmitting());

  /** Opens the modal for the given target user. Called by ReportUserModalService. */
  open(userId: string, contextUrl?: string): void {
    this.reportUserId.set(userId);
    this.contextUrl.set(contextUrl);
    this.formModel.set({ category: '', description: '', blockUser: false });
    this.errorMessage.set(null);
    this.isOpen.set(true);
    this.loadCategories();
  }

  categoryLabel(cat: ReportCategory): string {
    return this.i18n.translate(`report.category.${cat.value}.label`) || cat.label;
  }

  categoryDescription(cat: ReportCategory): string {
    return this.i18n.translate(`report.category.${cat.value}.description`) || cat.description || '';
  }

  loadCategories(): void {
    this.loadingCategories.set(true);
    this.loadError.set(false);

    this.safetyService
      .getReportCategories()
      .then((cats) => {
        this.categories.set(cats);
        this.loadingCategories.set(false);
      })
      .catch((err) => {
        console.error('Error loading categories:', err);
        this.loadError.set(true);
        this.loadingCategories.set(false);
      });
  }

  cancel(): void {
    this.isOpen.set(false);
    this.modalClosed.emit();
  }

  /** The Helm dialog reports every state transition, including ones this component
   * triggered itself via cancel()/submitReport() - only react to a 'closed'
   * that WE didn't already cause (backdrop click, Escape, or the primitive's
   * own close button), guarded by isOpen() so a self-triggered close is a
   * harmless no-op here rather than a double emit. */
  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.isOpen()) {
      this.isOpen.set(false);
      this.modalClosed.emit();
    }
  }

  async submitReport(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const model = this.formModel();
    const dto: ReportUserDto = {
      reported_id: this.reportUserId(),
      reason_category: model.category,
      description: model.description || undefined,
      context_url: this.contextUrl(),
    };

    try {
      await this.safetyService.reportUserAsync(dto);
      this.reported.emit();
      showToast(this.i18n.translate('report.toast_success'), 'success');

      if (model.blockUser) {
        this.safetyService
          .blockUserAsync(this.reportUserId())
          .catch((err) => console.error('Failed to block user after report:', err));
      }

      this.isOpen.set(false);
      this.modalClosed.emit();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.errorMessage.set(message || this.i18n.translate('report.toast_error'));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
