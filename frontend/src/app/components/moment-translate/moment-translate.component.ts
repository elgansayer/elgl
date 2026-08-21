import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-moment-translate',
  imports: [HlmButton, TranslatePipe],
  template: `
    <button
      hlmBtn
      type="button"
      (click)="toggle()"
      class="inline-flex items-center gap-1 ps-2 pe-2 py-0.5 rounded-full text-sm text-text-muted hover:text-accent transition-colors"
      [attr.aria-expanded]="showTranslation()"
    >
      {{ showTranslation() ? ('moments.hideTranslation' | t) : ('moments.translate' | t) }}
    </button>
    @if (showTranslation()) {
      @if (translationResource.isLoading()) {
        <p class="mt-1 text-xs text-text-muted">{{ 'common.loading' | t }}</p>
      } @else {
        @if (cachedTranslation() ?? translationResource.value()?.translation; as translation) {
          <p class="mt-1 text-sm text-text-secondary italic">{{ translation }}</p>
        } @else {
          <p class="mt-1 text-xs text-danger">{{ 'moments.translationError' | t }}</p>
        }
      }
    }
  `,
})
export class MomentTranslateComponent {
  readonly text = input.required<string>();
  readonly targetLanguage = input<string>('en-GB');

  readonly showTranslation = signal(false);
  private readonly i18n = inject(I18nService);
  private readonly translationCache = inject(TranslationCacheService);
  // Cache the translation client-side to avoid re-fetching on toggle (issue #447)
  readonly cachedTranslation = signal<string | null>(null);

  /** Triggers the resource loader only when translation is requested. */
  private readonly translateRequest = computed<{ text: string; target: string } | null>(() => {
    if (!this.showTranslation()) {
      return null;
    }
    return {
      text: this.text(),
      target: this.targetLanguage(),
    };
  });

  readonly translationResource = resource<{ translation?: string }, void>({
    loader: () => {
      const request = this.translateRequest();
      if (!request) {
        return Promise.resolve({});
      }
      // Serve from in-signal cache if already fetched (issue #446)
      const cached = this.cachedTranslation();
      if (cached !== null) {
        return Promise.resolve({ translation: cached });
      }
      // Check persistent translation cache (issue #1037)
      const persistentCached = this.translationCache.get(request.text, request.target);
      if (persistentCached !== null) {
        this.cachedTranslation.set(persistentCached);
        return Promise.resolve({ translation: persistentCached });
      }
      return fetch(`${environment.apiUrl}/nlp/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: request.text,
          target_language: request.target,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(this.i18n.translate('errors.translation.failed'));
          }
          return response.json();
        })
        .then((data: { translation: string | undefined }) => {
          const translation = data.translation ?? null;
          this.cachedTranslation.set(translation);
          if (translation) {
            this.translationCache.set(request.text, request.target, translation);
          }
          return { translation: translation ?? undefined };
        })
        .catch(() => {
          this.cachedTranslation.set(this.i18n.translate('moments.transError') ?? null);
          return {};
        });
    },
  });

  toggle(): void {
    this.showTranslation.update((value) => !value);
  }
}
