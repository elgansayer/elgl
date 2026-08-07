import { Component, inject, signal, input, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  SuggestFlashcardsService,
  SuggestResult,
} from '../../services/suggest-flashcards.service';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

@Component({
  selector: 'app-suggest-flashcards',
  standalone: true,
  imports: [FormsModule, TranslatePipe, AppSkeletonLoaderComponent, AppEmptyStateComponent],
  template: `
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
          [disabled]="!messageInput() || loading()"
        >
          {{ 'suggest_flashcards.suggest_button' | t }}
        </button>
        @if (loading()) {
          <div class="space-y-2" role="status" aria-busy="true">
            <app-skeleton-loader [height]="'14px'" [width]="'60%'" [variant]="'text'" />
            <app-skeleton-loader [height]="'14px'" [width]="'45%'" [variant]="'text'" />
            <app-skeleton-loader [height]="'14px'" [width]="'55%'" [variant]="'text'" />
          </div>
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
        @if (!loading() && !suggestions().length && !error() && hasSearched()) {
          <app-empty-state
            [icon]="'📝'"
            [description]="'suggest_flashcards.noWordsFound' | t"
            [customClass]="'py-4 border-0'"
          />
        }
      </section>
    </div>
  `,
})
export class SuggestFlashcardsComponent {
  private suggestService = inject(SuggestFlashcardsService);
  private i18n = inject(I18nService);
  private authService = inject(AuthService);

  /** Optional external message to auto‑suggest (e.g., from chat) */
  externalMessage = input<string>('');
  externalUserId = input<string | undefined>(undefined);
  externalTargetLanguage = input<string | undefined>(undefined);

  messageInput = signal<string>('');
  suggestions = signal<string[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  hasSearched = signal<boolean>(false);

  constructor() {
    effect(() => {
      const msg = this.externalMessage();
      if (msg && msg.trim()) {
        // Auto‑suggest when a parent provides a new message
        this.runSuggest(msg, this.externalUserId(), this.externalTargetLanguage());
      }
    });
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
    this.hasSearched.set(true);
    try {
      const result: SuggestResult = await this.suggestService.suggestFromMessage(
        message,
        userId,
        targetLanguage,
        true, // exclude known words by default
      );
      this.suggestions.set(result.suggestions);
    } catch {
      this.error.set(this.i18n.translate('suggest_flashcards.error'));
    } finally {
      this.loading.set(false);
    }
  }
}
