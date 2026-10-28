import { Component, computed, inject, resource, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { TranslatePipe } from '../../services/translate.pipe';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { showToast, showErrorToast } from '../../services/toast.service';

type ModerationAction = 'ban' | 'warn';
type ModerationOutcome = 'banned' | 'warned' | 'banFailed' | 'warningFailed';

interface ModerationActionState {
  pending?: ModerationAction;
  outcome?: ModerationOutcome;
}

@Component({
  selector: 'app-admin-actions',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <div class="m-4" role="region" [attr.aria-label]="'admin.quickModerationAria' | t">
      <h2>{{ 'admin.quickModeration' | t }}</h2>
      <ul role="list" class="space-y-2">
        @for (user of users(); track user.id) {
          <li class="flex flex-wrap items-center gap-2">
            <span class="me-auto break-words" dir="auto">{{ user.display_name ?? user.id }}</span>
            <button
              hlmBtn
              type="button"
              variant="destructive"
              size="sm"
              class="min-h-11 min-w-11"
              [disabled]="isActionDisabled(user.id, 'ban')"
              [attr.aria-busy]="isPending(user.id, 'ban') ? 'true' : null"
              [attr.aria-label]="'admin.banUserAria' | t: { name: user.display_name ?? user.id }"
              (click)="promptBan(user)"
            >
              {{ 'admin.banBtn' | t }}
            </button>
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="sm"
              class="min-h-11 min-w-11"
              [disabled]="isActionDisabled(user.id, 'warn')"
              [attr.aria-busy]="isPending(user.id, 'warn') ? 'true' : null"
              [attr.aria-label]="'admin.warnUserAria' | t: { name: user.display_name ?? user.id }"
              (click)="warn(user.id)"
            >
              {{ 'admin.warnBtn' | t }}
            </button>
            @if (statusKey(user.id); as key) {
              <span
                class="sr-only"
                [attr.role]="isFailure(user.id) ? 'alert' : 'status'"
                [attr.aria-live]="isFailure(user.id) ? 'assertive' : 'polite'"
              >
                {{ key | t }}
              </span>
            }
          </li>
        }
      </ul>
    </div>

    <hlm-dialog [state]="banDialogState()" (stateChanged)="onBanDialogStateChanged($event)">
      @if (pendingBanUser(); as targetUser) {
        <hlm-dialog-content
          *hlmDialogPortal
          [showCloseButton]="false"
          class="max-h-[calc(100dvh-2rem)] w-full max-w-sm space-y-5 overflow-y-auto rounded-sheet border border-surface-100 bg-surface-200 p-6 shadow-lift motion-reduce:animate-none"
        >
          <hlm-dialog-header>
            <h2
              hlmDialogTitle
              class="min-w-0 break-words text-sm font-medium leading-relaxed text-text-primary"
            >
              {{ 'admin.banConfirm' | t: { name: targetUser.display_name ?? targetUser.id } }}
            </h2>
          </hlm-dialog-header>
          <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="touch"
              class="w-full min-w-0 whitespace-normal break-words sm:w-auto"
              (click)="cancelBan()"
            >
              {{ 'common.cancel' | t }}
            </button>
            <button
              hlmBtn
              type="button"
              variant="destructive"
              size="touch"
              class="w-full min-w-0 whitespace-normal break-words sm:w-auto"
              (click)="confirmBan()"
            >
              {{ 'admin.banBtn' | t }}
            </button>
          </div>
        </hlm-dialog-content>
      }
    </hlm-dialog>
  `,
})
export class AdminActionsComponent {
  private readonly adminService = inject(AdminService);
  private readonly i18n = inject(I18nService);
  private readonly actionStates = signal<Record<string, ModerationActionState>>({});

  readonly pendingBanUser = signal<{ id: string; display_name?: string | null } | null>(null);
  readonly banDialogState = computed<HlmDialogState>(() =>
    this.pendingBanUser() ? 'open' : 'closed',
  );

  promptBan(user: { id: string; display_name?: string | null }): void {
    if (!user.id || this.isPending(user.id) || this.isActionDisabled(user.id, 'ban')) {
      return;
    }
    this.pendingBanUser.set(user);
  }

  cancelBan(): void {
    this.pendingBanUser.set(null);
  }

  onBanDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed') {
      this.cancelBan();
    }
  }

  async confirmBan(): Promise<void> {
    const user = this.pendingBanUser();
    if (!user) return;
    this.cancelBan();
    await this.ban(user.id);
  }

  private readonly usersResource = resource({
    params: () => ({ page: 1, pageSize: 10, search: '' }),
    loader: ({ params }) => this.adminService.listUsers(params.search, params.page, params.pageSize),
  });

  readonly users = computed(() => this.usersResource.value()?.users ?? []);

  isPending(userId: string, action?: ModerationAction): boolean {
    const pending = this.actionStates()[userId]?.pending;
    return action ? pending === action : pending !== undefined;
  }

  isActionDisabled(userId: string, action: ModerationAction): boolean {
    const state = this.actionStates()[userId];
    if (state?.pending) {
      return true;
    }
    return action === 'ban' ? state?.outcome === 'banned' : state?.outcome === 'warned';
  }

  statusKey(userId: string): string | null {
    switch (this.actionStates()[userId]?.outcome) {
      case 'banned':
        return 'admin.userBanned';
      case 'warned':
        return 'admin.warningIssued';
      case 'banFailed':
        return 'admin.banFailed';
      case 'warningFailed':
        return 'admin.warningFailed';
      default:
        return null;
    }
  }

  isFailure(userId: string): boolean {
    const outcome = this.actionStates()[userId]?.outcome;
    return outcome === 'banFailed' || outcome === 'warningFailed';
  }

  async ban(userId: string): Promise<void> {
    await this.runModerationAction(userId, 'ban');
  }

  async warn(userId: string): Promise<void> {
    await this.runModerationAction(userId, 'warn');
  }

  private async runModerationAction(userId: string, action: ModerationAction): Promise<void> {
    if (!userId || this.isPending(userId) || this.isActionDisabled(userId, action)) {
      return;
    }

    this.setActionState(userId, { pending: action });

    try {
      if (action === 'ban') {
        await this.adminService.banUser(userId);
        this.setActionState(userId, { outcome: 'banned' });
        showToast(this.i18n.translate('admin.userBanned'), 'success');
      } else {
        await this.adminService.warnUser(userId);
        this.setActionState(userId, { outcome: 'warned' });
        showToast(this.i18n.translate('admin.warningIssued'), 'success');
      }
    } catch {
      const outcome: ModerationOutcome = action === 'ban' ? 'banFailed' : 'warningFailed';
      this.setActionState(userId, { outcome });
      showErrorToast(
        this.i18n.translate(action === 'ban' ? 'admin.banFailed' : 'admin.warningFailed'),
      );
    }
  }

  private setActionState(userId: string, state: ModerationActionState): void {
    this.actionStates.update((states) => ({ ...states, [userId]: state }));
  }
}
