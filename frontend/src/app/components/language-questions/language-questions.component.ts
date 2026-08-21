import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, input, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UpperCasePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { environment } from '../../../environments/environment';

export interface LanguageQuestion {
  id: string;
  user_id: string;
  question_text: string;
  question_options: string[];
  target_language: string;
  author?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  correct_answers_count?: number;
  total_answers_count?: number;
}

@Component({
  selector: 'app-language-questions',
  imports: [HlmButton, TranslatePipe, UpperCasePipe],
  template: `
    <section class="space-y-4" role="region" aria-label="{{ 'moments.questions' | t }}">
      <h2 class="text-lg font-bold text-text-primary">{{ 'moments.questions' | t }}</h2>
      @for (q of questions(); track q.id) {
        <article class="bg-surface rounded-xl p-4 space-y-2">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-text-primary">{{ q.target_language | uppercase }}</span>
            <span class="text-sm text-text-muted ms-auto">
              @if (q.correct_answers_count !== null && q.total_answers_count !== null) {
                {{ q.correct_answers_count }} / {{ q.total_answers_count }}
              }
            </span>
          </div>
          <p class="text-text-primary">{{ q.question_text }}</p>
          <div class="grid grid-cols-1 gap-2">
            @for (opt of q.question_options; track opt) {
              <button
                hlmBtn
                type="button"
                class="text-start px-3 py-2 rounded border border-surface-hover bg-surface-alt text-text-primary hover:bg-surface-hover transition"
                (click)="submitAnswer(q.id, opt)"
              >
                {{ opt }}
              </button>
            }
          </div>
        </article>
      } @empty {
        <p class="text-text-muted">{{ 'moments.noQuestions' | t }}</p>
      }
    </section>
  `,
  styles: [':host { display: block; }'],
})
export class LanguageQuestionsComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly apiUrl = environment.apiUrl;

  readonly targetLanguage = input<string>('');

  private readonly questionsResource = resource({
    loader: () => this.loadQuestions(),
  });

  protected readonly questions = computed(() => this.questionsResource.value() ?? []);

  private async loadQuestions(): Promise<LanguageQuestion[]> {
    const headers: Record<string, string> = {};
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const url = `${this.apiUrl}/moments/questions${this.targetLanguage() ? `?lang=${this.targetLanguage()}` : ''}`;
    return await firstValueFrom(this.http.get<LanguageQuestion[]>(url, { headers }));
  }

  protected async submitAnswer(questionId: string, answer: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<{ correct: boolean }>(`${this.apiUrl}/moments/${questionId}/answer`, {
          answer,
        }),
      );
      await this.questionsResource.reload();
    } catch {
      this.i18n.translate('common.error');
    }
  }
}
