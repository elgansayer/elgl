import { Component, inject, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

export interface WordOfTheDay {
  word: string;
  translation: string;
  language: string;
  languageCode: string;
  example: string;
  date: string;
}

const WORD_OF_THE_DAY_FIELDS: readonly (keyof WordOfTheDay)[] = [
  'word',
  'translation',
  'language',
  'languageCode',
  'example',
  'date',
];

function isWordOfTheDay(value: unknown): value is WordOfTheDay {
  if (typeof value !== 'object' || value === null) return false;
  return WORD_OF_THE_DAY_FIELDS.every((field) => {
    const fieldValue: unknown = Reflect.get(value, field);
    return typeof fieldValue === 'string' && fieldValue.trim().length > 0;
  });
}

@Component({
  selector: 'app-word-of-the-day',
  imports: [TranslatePipe],
  template: `
    <section
      class="bg-surface-300 rounded-xl p-4 space-y-2 min-w-0"
      role="region"
      aria-label="{{ 'home.wordOfDay.title' | t }}"
      [attr.aria-busy]="wordOfTheDayResource.isLoading()"
    >
      <h2 class="text-sm uppercase tracking-wider text-text-muted font-medium">
        {{ 'home.wordOfDay.title' | t }}
      </h2>

      @if (wordOfTheDayResource.isLoading()) {
        <p class="text-sm text-text-muted" role="status">{{ 'common.loading' | t }}</p>
      } @else if (wordOfTheDayResource.error()) {
        <p class="text-sm text-text-muted" role="alert">{{ 'common.error_generic' | t }}</p>
      } @else if (wordOfTheDayResource.value(); as dailyWord) {
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
          <span class="text-3xl font-bold text-accent break-words">{{ dailyWord.word }}</span>
          <span class="text-lg text-text-secondary break-words">{{ dailyWord.translation }}</span>
          <span class="text-sm text-text-muted sm:ms-auto">{{ dailyWord.language }}</span>
        </div>
        <p class="text-sm text-text-muted italic break-words">{{ dailyWord.example }}</p>
      }
    </section>
  `,
  styles: [':host { display: block; min-width: 0; }'],
})
export class WordOfTheDayComponent {
  private readonly authService = inject(AuthService);

  protected readonly wordOfTheDayResource = resource<WordOfTheDay, unknown>({
    loader: async ({ abortSignal }) => {
      const token = this.authService.getAccessToken();
      if (!token) throw new Error('Authenticated session required');

      const response = await fetch(`${environment.apiUrl}/word-of-the-day`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortSignal,
      });
      if (!response.ok) throw new Error('Failed to fetch word of the day');
      const dailyWord: unknown = await response.json();
      if (!isWordOfTheDay(dailyWord)) {
        throw new Error('Invalid word of the day response');
      }
      return dailyWord;
    },
  });
}
