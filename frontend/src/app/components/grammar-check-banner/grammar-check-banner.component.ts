import { Component, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { VocabularyStore, GrammarCheckResult } from '../../services/vocabulary.store';
import { showToast } from '../../services/toast.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-grammar-check-banner',
  imports: [FormsModule, TranslatePipe],
  template: `
    @if (showBanner()) {
      <div
        class="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-3 space-y-2 animate-fadeIn"
        role="alert"
        aria-live="polite"
      >
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-amber-400 text-sm">&#9888;</span>
            <span class="text-xs font-bold text-amber-400">
              {{ 'grammar.bannerTitle' | t: { count: grammarResult()?.errors_found ?? 0 } }}
            </span>
          </div>
          <button
            (click)="dismissGrammarBanner()"
            class="text-text-muted hover:text-text-primary text-xs"
            [attr.aria-label]="'common.dismiss' | t"
          >
            &#10005;
          </button>
        </div>

        <!-- Suggestion -->
        @if (grammarResult(); as result) {
          @if (result.corrected !== result.original) {
            <div class="bg-surface-300/80 rounded-xl p-2.5">
              <div class="text-[10px] text-text-secondary uppercase tracking-wider mb-1">
                {{ 'grammar.suggestedCorrection' | t }}
              </div>
              <p class="text-sm text-text-primary font-medium">{{ result.corrected }}</p>
              @if (result.explanation) {
                <p class="text-[11px] text-text-secondary mt-1 italic">{{ result.explanation }}</p>
              }
            </div>
          }
        }

        <!-- Action buttons -->
        <div class="flex items-center gap-2 pt-1">
          <button
            (click)="applyCorrection()"
            class="px-3 py-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-full hover:opacity-90 transition-all shadow-sm"
          >
            {{ 'grammar.applyBtn' | t }}
          </button>
          <button
            (click)="ignoreAndSend()"
            class="px-3 py-1.5 text-[11px] font-bold text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-300 transition-colors"
          >
            {{ 'grammar.ignoreBtn' | t }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fadeIn {
        animation: fadeIn 0.2s ease-out;
      }
    `,
  ],
})
export class GrammarCheckBannerComponent {
  text = input<string>('');
  language = input<string>();

  readonly corrected = output<string>();
  readonly ignored = output<string>();

  private readonly vocabStore = inject(VocabularyStore);
  private readonly i18n = inject(I18nService);

  readonly showBanner = signal(false);
  readonly grammarResult = signal<GrammarCheckResult | null>(null);
  readonly isChecking = signal(false);

  async check(): Promise<void> {
    const text = this.text().trim();
    if (!text || text.length < 3) return;

    this.isChecking.set(true);
    try {
      const result = await this.vocabStore.checkGrammar(text, this.language());
      this.grammarResult.set(result);

      if (result.errors_found > 0 || result.corrected !== result.original) {
        this.showBanner.set(true);
      }
    } catch {
      showToast(this.i18n.translate('grammar.errorAlert'));
    } finally {
      this.isChecking.set(false);
    }
  }

  applyCorrection(): void {
    const result = this.grammarResult();
    if (result?.corrected) {
      this.corrected.emit(result.corrected);
    }
    this.showBanner.set(false);
    this.grammarResult.set(null);
  }

  ignoreAndSend(): void {
    this.ignored.emit(this.grammarResult()?.original ?? this.text());
    this.showBanner.set(false);
    this.grammarResult.set(null);
  }

  dismissGrammarBanner(): void {
    this.showBanner.set(false);
    this.grammarResult.set(null);
  }
}