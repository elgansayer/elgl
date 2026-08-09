import { Component, inject, signal, input, effect, computed, viewChild, ErrorHandler } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  SuggestFlashcardsService,
  SuggestResult,
} from '../../services/suggest-flashcards.service';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import {
  SrsErrorBoundaryComponent,
  SrsErrorContext,
} from '../srs-error-boundary/srs-error-boundary.component';

@Component({
  selector: 'app-suggest-flashcards',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SrsErrorBoundaryComponent],
  template: `
    <app-srs-error-boundary
      [context]="errorContext()"
      [showReportButton]="true"
      (retry)="handleRetry()"
    >
      <div class="mx-auto max-w-2xl space-y-4 pb-20 pt-4">
        <section class="app-card app-padded space-y-4">
          <h2 class="app-section-title">{{ 'suggest_flashcards.title' | t }}</h2>
          <textarea
            [(ngModel)]="messageInput"
            [placeholder]="'suggest_flashcards.placeholder' | t"
            rows="3"
            class="app-textarea"
          ></textarea>
          <button
            (click)="manualSuggest()"
            class="app-button-primary ps-4 pe-4 pt-2.5 pb-2.5 text-xs font-bold disabled:opacity-60"
            [disabled]="!messageInput()"
          >
            {{ 'suggest_flashcards.suggest_button' | t }}
          </button>
          @if (loading()) {
            <p class="app-muted">{{ 'suggest_flashcards.loading' | t }}</p>
          }
          @if (suggestions().length > 0) {
            <ul class="mt-4 list-disc ps-5">
              @for (word of suggestions(); track word) {
                <li class="text-sm text-text-primary">{{ word }}</li>
              }
            </ul>
          }
          @if (error()) {
            <p class="mt-2 text-xs font-bold text-rose-400">{{ error() }}</p>
          }
        </section>
      </div>
    </app-srs-error-boundary>
  `,
})
export class SuggestFlashcardsComponent {
  private suggestService = inject(SuggestFlashcardsService);
  private i18n = inject(I18nService);
  private authService = inject(AuthService);
  private errorHandler = inject(ErrorHandler);

  /** Optional external message to auto‑suggest (e.g., from chat) */
  externalMessage = input<string>('');
  externalUserId = input<string | undefined>(undefined);
  externalTargetLanguage = input<string | undefined>(undefined);

  messageInput = signal<string>('');
  suggestions = signal<string[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  readonly errorBoundary = viewChild(SrsErrorBoundaryComponent);

  readonly errorContext = computed<SrsErrorContext>(() => ({
    component: 'suggest-flashcards',
    operation: 'suggest',
    metadata: {
      messageLength: this.messageInput().length,
      hasExternalMessage: !!this.externalMessage(),
    },
  }));

  constructor() {
    effect(() => {
      const msg = this.externalMessage();
      if (msg && msg.trim()) {
        this.runSuggest(msg, this.externalUserId(), this.externalTargetLanguage());
      }
    });
  }

  handleRetry(): void {
    this.error.set(null);
    const msg = this.messageInput().trim();
    if (msg) {
      this.runSuggest(msg);
    }
  }

  /** Called when the user clicks the button */
  async manualSuggest(): Promise<void> {
    const msg = this.messageInput().trim();
    if (!msg) return;
    this.runSuggest(msg);
  }

  private async runSuggest(
    message: string,
    userId?: string,
    targetLanguage?: string,
  ): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.suggestions.set([]);
    try {
      const result: SuggestResult = await this.suggestService.suggestFromMessage(
        message,
        userId,
        targetLanguage,
        true,
      );
      this.suggestions.set(result.suggestions);
    } catch (err) {
      this.error.set(this.i18n.translate('suggest_flashcards.error'));
      this.handleError(err, 'runSuggest');
    } finally {
      this.loading.set(false);
    }
  }

  private handleError(err: unknown, operation: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.errorBoundary()?.captureError(error, undefined, {
      operation,
      messageLength: this.messageInput().length,
    });
  }
}
