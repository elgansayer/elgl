import { Component, computed, resource } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { environment } from '../../../environments/environment';

export interface WordOfTheDay {
  word: string;
  translation: string;
  language: string;
  languageCode?: string;
  example?: string;
  date?: string;
}

function isWordOfTheDay(value: unknown): value is WordOfTheDay {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return ['word', 'translation', 'language'].every(
    (field) => typeof record[field] === 'string' && record[field].trim().length > 0,
  );
}

@Component({
  selector: 'app-word-of-the-day',
  imports: [HlmButton, TranslatePipe],
  template: `
    <section
      class="bg-surface-300 rounded-xl p-4 space-y-2"
      role="region"
      [attr.aria-label]="'home.wordOfDay.title' | t"
      [attr.aria-busy]="isLoading()"
    >
      <h2 class="text-sm uppercase tracking-wider text-text-muted font-medium">
        {{ 'home.wordOfDay.title' | t }}
      </h2>

      @if (isLoading()) {
        <p class="text-sm text-text-muted" role="status">{{ 'common.loading' | t }}</p>
      } @else if (hasError()) {
        <div class="space-y-3" role="alert">
          <p class="text-sm text-text-muted">{{ 'common.error_generic' | t }}</p>
          <button hlmBtn size="touch" type="button" variant="outline" (click)="reload()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (wordOfTheDay(); as entry) {
        <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="break-words text-3xl font-bold text-accent">{{ entry.word }}</span>
          <span class="break-words text-lg text-text-secondary">{{ entry.translation }}</span>
          <span class="text-sm text-text-muted sm:ms-auto">{{ entry.language }}</span>
        </div>
        @if (entry.example; as example) {
          <p class="break-words text-sm italic text-text-muted">{{ example }}</p>
        }
      }
    </section>
  `,
  styles: [':host { display: block; }'],
})
export class WordOfTheDayComponent {
  private readonly wordOfTheDayResource = resource<WordOfTheDay, unknown>({
    loader: async () => {
      const response = await fetch(`${environment.apiUrl}/word-of-the-day`);
      if (!response.ok) {
        throw new Error('Failed to fetch word of the day');
      }

      const payload: unknown = await response.json();
      if (!isWordOfTheDay(payload)) {
        throw new Error('Invalid word of the day response');
      }

      return payload;
    },
  });

  protected readonly wordOfTheDay = computed(() => this.wordOfTheDayResource.value());
  protected readonly isLoading = computed(() => this.wordOfTheDayResource.isLoading());
  protected readonly hasError = computed(() => this.wordOfTheDayResource.error() !== undefined);

  protected reload(): void {
    this.wordOfTheDayResource.reload();
  }
}
