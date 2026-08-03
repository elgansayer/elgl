import { Component, computed, input, resource, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { environment } from '../../../environments/environment';


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
      } @else if (translationResource.value()?.translation !== undefined; as translation) {
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

  readonly translationResource = resource({
    loader: () => {
      const request = this.translateRequest();
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
        .then((data: { translation: string | undefined }) => {
          if (data.translation) {
            return { translation: data.translation };
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
