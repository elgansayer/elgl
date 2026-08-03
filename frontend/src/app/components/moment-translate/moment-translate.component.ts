import { Component, computed, input, resource, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { environment } from '../../../environments/environment';

interface TranslationResponse {
  translation?: string;
}

@Component({
  selector: 'app-moment-translate',
  imports: [TranslatePipe],
  template: `
    <button
      type="button"
      (click)="toggle()"
      class="inline-flex items-center gap-1 ps-2 pe-2 py-0.5 rounded-full text-sm text-gray-400 hover:text-accent transition-colors"
      [attr.aria-expanded]="showTranslation()"
    >
      {{ showTranslation() ? ('moments.hideTranslation' | t) : ('moments.translate' | t) }}
    </button>
    @if (showTranslation()) {
      @if (translationResource.isLoading()) {
        <p class="mt-1 text-xs text-gray-400">{{ 'common.loading' | t }}</p>
      } @else if (translationResource.value()?.translation; as translation) {
        <p class="mt-1 text-sm text-gray-300 italic">{{ translation }}</p>
      } @else {
        <p class="mt-1 text-xs text-rose-500">{{ 'moments.translationError' | t }}</p>
      }
    }
  `,
})
export class MomentTranslateComponent {
  readonly text = input.required<string>();
  readonly targetLanguage = input<string>('en-GB');

  readonly showTranslation = signal(false);

  private readonly translateRequest = computed<{ text: string; target: string } | null>(() => {
    if (!this.showTranslation()) {
      return null;
    }
    return {
      text: this.text(),
      target: this.targetLanguage(),
    };
  });

  readonly translationResource = resource<TranslationResponse, { text: string; target: string } | null>({
    request: this.translateRequest,
    loader: ({ request }) => {
      if (!request) {
        return Promise.resolve({});
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
            throw new Error('Translation failed');
          }
          return response.json();
        })
        .then((data: unknown) => {
          if (typeof data === 'object' && data !== null && 'translation' in data) {
            const maybeTranslation: unknown = data.translation;
            if (typeof maybeTranslation === 'string') {
              return { translation: maybeTranslation };
            }
          }
          return {};
        })
        .catch(() => ({}));
    },
  });

  toggle(): void {
    this.showTranslation.update((value) => !value);
  }
}
