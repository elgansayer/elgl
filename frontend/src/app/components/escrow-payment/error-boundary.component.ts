import {
  Component,
  signal,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { ApiService } from '../../services/api.service';
import { TranslatePipe } from '../../services/translate.pipe';

export interface EscrowErrorReport {
  errorCode: string;
  message: string;
  isRecoverable: boolean;
  escrowId?: string;
  timestamp: string;
}

@Component({
  selector: 'app-escrow-error-boundary',
  template: `
    <div class="escrow-error-boundary rounded-2xl p-6 flex flex-col items-center gap-4 text-center"
      [style.background-color]="'#1a1a2e'">
      <svg class="w-16 h-16 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" stroke-linecap="round" stroke-linejoin="round" />
      </svg>

      <h2 class="text-xl font-bold text-white">{{ errorTitle() }}</h2>

      <p class="text-sm text-slate-400 max-w-md">{{ errorMessage() }}</p>

      @if (errorDetails()) {
        <div class="w-full bg-black/30 rounded-lg p-3 text-start font-mono text-xs text-slate-400 overflow-auto max-h-32">
          <span class="text-red-400">[{{ errorDetails()!.errorCode }}]</span>
          {{ errorDetails()!.message }}
        </div>
      }

      <div class="flex gap-3 mt-2">
        @if (isRecoverable()) {
          <button
            class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            (click)="handleRetry()">
            {{ 'escrow.error.retry' | t }}
          </button>
        }
        <button
          class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          (click)="handleDismiss()">
          {{ 'escrow.error.dismiss' | t }}
        </button>
        <button
          class="px-4 py-2 bg-transparent border border-slate-600 hover:border-slate-400 text-slate-300 rounded-lg transition-colors"
          (click)="handleReportCrash()">
          {{ 'escrow.error.report' | t }}
        </button>
      </div>
    </div>
  `,
  standalone: true,
  imports: [TranslatePipe],
  styles: [
    ':host { display: block; }',
  ],
})
export class EscrowErrorBoundaryComponent {
  error = input.required<EscrowErrorReport>();
  retryRequested = output<void>();
  dismissed = output<void>();

  private i18nService = inject(I18nService);
  private apiService = inject(ApiService);

  readonly isRecoverable = computed(() => this.error().isRecoverable);
  readonly isReporting = signal(false);
  readonly reportStatus = signal<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  readonly errorTitle = computed(() => {
    const code = this.error().errorCode;
    const translated = this.i18nService.translate(`escrow.error.title.${code}`);
    if (translated !== `escrow.error.title.${code}`) return translated;
    return this.i18nService.translate('escrow.error.title.default');
  });

  readonly errorMessage = computed(() => {
    const code = this.error().errorCode;
    const translated = this.i18nService.translate(`escrow.error.message.${code}`);
    if (translated !== `escrow.error.message.${code}`) return translated;
    return this.error().message;
  });

  readonly errorDetails = computed(() => this.error());

  handleRetry(): void {
    this.retryRequested.emit();
  }

  handleDismiss(): void {
    this.dismissed.emit();
  }

  async handleReportCrash(): Promise<void> {
    if (this.isReporting()) return;

    this.isReporting.set(true);
    this.reportStatus.set('sending');

    try {
      await this.apiService.post(
        '/api/analytics/client-error',
        {
          message: `[Escrow:UserReported] ${this.error().message}`,
          name: `EscrowError:${this.error().errorCode}`,
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          metadata: {
            escrowErrorCode: this.error().errorCode,
            escrowId: this.error().escrowId,
            isUserReported: true,
            isRecoverable: this.error().isRecoverable,
          },
          timestamp: new Date().toISOString(),
        },
        { requireAuth: false },
      );
      this.reportStatus.set('sent');
    } catch {
      this.reportStatus.set('failed');
    } finally {
      this.isReporting.set(false);
    }
  }
}