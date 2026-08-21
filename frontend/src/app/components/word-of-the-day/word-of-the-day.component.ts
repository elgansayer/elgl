import { Component, computed, resource, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

export interface WordOfTheDay {
  word: string;
  translation: string;
  language: string;
  example?: string;
}

@Component({
  selector: 'app-word-of-the-day',
  imports: [TranslatePipe],
  template: `
    <section
      class="bg-surface-300 rounded-xl p-4 space-y-2"
      role="region"
      aria-label="{{ 'home.wordOfDay.title' | t }}"
    >
      <h2 class="text-sm uppercase tracking-wider text-text-muted font-medium">
        {{ 'home.wordOfDay.title' | t }}
      </h2>
      <div class="flex items-center gap-3">
        <span class="text-3xl font-bold text-accent">{{ word() }}</span>
        <span class="text-lg text-text-secondary">{{ translation() }}</span>
        <span class="text-sm text-text-muted ms-auto">{{ language() }}</span>
      </div>
      @if (example(); as ex) {
        <p class="text-sm text-text-muted italic">{{ ex }}</p>
      }
    </section>
  `,
  styles: [':host { display: block; }'],
})
export class WordOfTheDayComponent {
  private readonly authService = inject(AuthService);

  private readonly wordOfTheDayResource = resource<WordOfTheDay, unknown>({
    loader: () => {
      const token = this.authService.getAccessToken();
      if (!token) {
        return Promise.resolve({
          word: 'Hola',
          translation: 'Hello',
          language: 'Spanish',
          example: '¡Hola! ¿Cómo estás?',
        });
      }
      return fetch(`${environment.apiUrl}/word-of-the-day`)
        .then((r) => {
          if (!r.ok) throw new Error('Failed to fetch word of the day');
          return r.json();
        })
        .catch(() => ({
          word: 'Hola',
          translation: 'Hello',
          language: 'Spanish',
          example: '¡Hola! ¿Cómo estás?',
        }));
    },
  });

  protected readonly word = computed(() => this.wordOfTheDayResource.value()?.word ?? 'Hola');
  protected readonly translation = computed(
    () => this.wordOfTheDayResource.value()?.translation ?? 'Hello',
  );
  protected readonly language = computed(
    () => this.wordOfTheDayResource.value()?.language ?? 'Spanish',
  );
  protected readonly example = computed(() => this.wordOfTheDayResource.value()?.example);
}
