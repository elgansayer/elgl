import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, output, signal } from '@angular/core';
import { form, required, FormField } from '@angular/forms/signals';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import {
  SafetyService,
  ReportCategory,
  ReportUserDto,
  SAFETY_REPORT_CATEGORIES,
  type SafetyReportCategory,
  type SafetyReportTargetType,
} from '../../services/safety.service';
import { showToast } from '../../services/toast.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

interface ReportFormModel {
  category: SafetyReportCategory | '';
  description: string;
  blockUser: boolean;
}

/**
 * Narrows a form value to a reason the API accepts. The backend validates the
 * same closed set, so an unknown value is rejected here rather than producing
 * a failed request.
 */
function isSafetyReportCategory(value: string): value is SafetyReportCategory {
  return SAFETY_REPORT_CATEGORIES.some((category) => category === value);
}

/**
 * Maps a failed report request to a translated, user-safe message key. Raw
 * transport errors carry request URLs and provider detail, so they are never
 * shown to the reporter.
 */
export function reportFailureMessageKey(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 429) return 'report.rate_limited';
    if (error.status === 404) return 'report.target_not_found';
  }
  return 'report.toast_error';
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
  private readonly targetType = signal<SafetyReportTargetType>('user');

  /**
   * Personal and business accounts share one `users` record, so the same
   * endpoint handles both. Only the wording changes, which keeps the reporter
   * informed about which account they are acting on.
   */
  readonly title = computed(() => this.i18n.translate(`report.title.${this.targetType()}`));
  readonly intro = computed(() => this.i18n.translate(`report.intro.${this.targetType()}`));

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
  open(userId: string, contextUrl?: string, targetType: SafetyReportTargetType = 'user'): void {
    this.reportUserId.set(userId);
    this.contextUrl.set(contextUrl);
    this.targetType.set(targetType);
    this.formModel.set({ category: '', description: '', blockUser: false });
    this.errorMessage.set(null);
    this.isOpen.set(true);
    this.loadCategories();
  }

  categoryLabel(cat: ReportCategory): string {
    const key = `report.category.${cat.value}.label`;
    const translated = this.i18n.translate(key);
    return translated === key ? cat.label : translated;
  }

  categoryDescription(cat: ReportCategory): string {
    const key = `report.category.${cat.value}.description`;
    const translated = this.i18n.translate(key);
    if (translated !== key) return translated;
    return cat.description ?? '';
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

    const model = this.formModel();
    if (!isSafetyReportCategory(model.category)) {
      this.errorMessage.set(this.i18n.translate('report.category_required'));
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const dto: ReportUserDto = {
      reported_id: this.reportUserId(),
      reason_category: model.category,
      description: model.description || undefined,
      context_url: this.contextUrl(),
    };

    try {
      const result = await this.safetyService.reportUserAsync(dto);
      this.reported.emit();
      showToast(
        this.i18n.translate(result.duplicate ? 'report.toast_duplicate' : 'report.toast_success'),
        'success',
      );

      if (model.blockUser) {
        try {
          await this.safetyService.blockUserAsync(this.reportUserId());
          showToast(this.i18n.translate('report.block_success'), 'success');
        } catch {
          showToast(this.i18n.translate('report.block_failed'), 'error');
        }
      }

      this.isOpen.set(false);
      this.modalClosed.emit();
    } catch (err: unknown) {
      this.errorMessage.set(this.i18n.translate(reportFailureMessageKey(err)));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
