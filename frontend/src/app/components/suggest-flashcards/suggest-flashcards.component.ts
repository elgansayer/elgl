import { Component, inject, signal, input, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  SuggestFlashcardsService,
  SuggestResult,
} from '../../services/suggest-flashcards.service';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-suggest-flashcards',
  standalone: true,
  imports: [FormsModule, TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
  template: `
    <div class="p-4 bg-surface rounded-xl">
      <h2 class="text-lg font-semibold mb-2">
        {{ 'suggest_flashcards.title' | t }}
      </h2>
      <textarea
        [(ngModel)]="messageInput"
        placeholder="{{ 'suggest_flashcards.placeholder' | t }}"
        rows="3"
        class="w-full border rounded p-2 bg-background text-foreground"
      ></textarea>
      <button
        (click)="manualSuggest()"
        class="mt-2 btn-primary"
        [disabled]="!messageInput() || loading()"
      >
        {{ 'suggest_flashcards.suggest_button' | t }}
      </button>

      @if (loading()) {
        <div class="mt-4 space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="flex items-center gap-2">
              <app-skeleton-loader [height]="'8px'" [width]="'8px'" [borderRadius]="'50%'" />
              <app-skeleton-loader [height]="'14px'" [width]="'60%'" [variant]="'text'" />
            </div>
          }
        </div>
      }

      @if (!loading() && !error() && suggestions().length > 0) {
        <ul class="mt-4 list-disc ps-5">
          @for (word of suggestions(); track word) {
            <li class="text-sm">{{ word }}</li>
          }
        </ul>
      }

      @if (!loading() && !error() && previousResult() === false && suggestions().length === 0) {
        <app-empty-state
          icon="💡"
          [title]="'suggest_flashcards.emptyTitle' | t"
          [description]="'suggest_flashcards.emptyDesc' | t"
          [customClass]="'py-4'"
        />
      }

      @if (error()) {
        <p class="text-red-500 mt-2">{{ error() }}</p>
      }
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
<<<<<<< HEAD
  /** Set to true when a suggestion request has been made at least once */
  previousResult = signal<boolean>(false);
=======
>>>>>>> origin/main

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
    try {
      const result: SuggestResult = await this.suggestService.suggestFromMessage(
        message,
        userId,
        targetLanguage,
        true, // exclude known words by default
      );
      this.suggestions.set(result.suggestions);
      this.previousResult.set(true);
    } catch {
      this.error.set(this.i18n.translate('suggest_flashcards.error'));
      this.previousResult.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
