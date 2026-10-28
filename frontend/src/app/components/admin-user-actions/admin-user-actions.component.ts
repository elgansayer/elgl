import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, signal, computed, inject } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { showToast, showErrorToast } from '../../services/toast.service';

export interface ActionFeedback {
  type: 'success' | 'error';
  messageKey: string;
}

@Component({
  imports: [HlmButton, TranslatePipe],
  selector: 'app-admin-user-actions',
  template: `
    <div class="flex flex-col gap-1.5">
      <div class="flex gap-2">
        <button
          hlmBtn
          size="sm"
          type="button"
          [disabled]="isBusy()"
          [attr.aria-busy]="isBanning() ? 'true' : null"
          (click)="handleBan()"
          class="bg-danger text-on-fill hover:bg-danger/90"
        >
          {{ 'admin.banBtn' | t }}
        </button>
        <button
          hlmBtn
          size="sm"
          type="button"
          [disabled]="isBusy()"
          [attr.aria-busy]="isWarning() ? 'true' : null"
          (click)="handleWarn()"
          class="bg-warning text-on-fill hover:bg-warning/90"
        >
          {{ 'admin.warnBtn' | t }}
        </button>
      </div>
      @if (feedback(); as fb) {
        <p
          class="text-xs"
          [class.text-success]="fb.type === 'success'"
          [class.text-danger]="fb.type === 'error'"
          role="status"
          aria-live="polite"
        >
          {{ fb.messageKey | t }}
        </p>
      }
    </div>
  `,
})
export class AdminUserActionsComponent {
  userId = input.required<string>();

  userBanned = output<string>();
  userWarned = output<string>();

  readonly isBanning = signal(false);
  readonly isWarning = signal(false);
  readonly isBusy = computed(() => this.isBanning() || this.isWarning());
  readonly feedback = signal<ActionFeedback | null>(null);

  private adminService = inject(AdminService);
  private i18n = inject(I18nService);

  async handleBan(): Promise<void> {
    const id = this.userId();
    if (!id || this.isBusy()) return;

    this.isBanning.set(true);
    this.feedback.set(null);
    try {
      await this.adminService.banUser(id);
      this.feedback.set({ type: 'success', messageKey: 'admin.userBanned' });
      showToast(this.i18n.translate('admin.userBanned'), 'success');
      this.userBanned.emit(id);
    } catch {
      this.feedback.set({ type: 'error', messageKey: 'admin.banFailed' });
      showErrorToast(this.i18n.translate('admin.banFailed'));
    } finally {
      this.isBanning.set(false);
    }
  }

  async handleWarn(): Promise<void> {
    const id = this.userId();
    if (!id || this.isBusy()) return;

    this.isWarning.set(true);
    this.feedback.set(null);
    try {
      await this.adminService.warnUser(id);
      this.feedback.set({ type: 'success', messageKey: 'admin.warningIssued' });
      showToast(this.i18n.translate('admin.warningIssued'), 'success');
      this.userWarned.emit(id);
    } catch {
      this.feedback.set({ type: 'error', messageKey: 'admin.warningFailed' });
      showErrorToast(this.i18n.translate('admin.warningFailed'));
    } finally {
      this.isWarning.set(false);
    }
  }
}

