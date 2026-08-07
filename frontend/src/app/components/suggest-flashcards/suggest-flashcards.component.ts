import { Component, inject, signal, input, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  SuggestFlashcardsService,
  SuggestResult,
} from '../../services/suggest-flashcards.service';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-suggest-flashcards',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
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
        [disabled]="!messageInput()"
      >
        {{ 'suggest_flashcards.suggest_button' | t }}
      </button>
      @if (loading()) {
        <p>{{ 'suggest_flashcards.loading' | t }}</p>
      }
      @if (suggestions().length > 0) {
        <ul class="mt-4 list-disc ps-5">
          @for (word of suggestions(); track word) {
            <li class="text-sm">{{ word }}</li>
          }
        </ul>
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
    } catch {
      this.error.set(this.i18n.translate('suggest_flashcards.error'));
    } finally {
      this.loading.set(false);
    }
  }
}
