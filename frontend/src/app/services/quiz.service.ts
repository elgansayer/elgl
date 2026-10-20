import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface QuizQuestion {
  id: string;
  text: string;
  skill: string;
  category: string;
  options: { id: string; text: string }[];
}

export interface DiagnosticQuizResult {
  score: number;
  maxScore: number;
  percentage: number;
  suggestedCefr: string;
  skillBreakdown: Record<
    string,
    { score: number; max: number; percentage: number }
  >;
  description: string;
}

export interface QuizSubmission {
  targetLanguage: string;
  answers: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly http = inject(HttpClient);

  getQuestions(language: string): Promise<QuizQuestion[]> {
    const params = new HttpParams().set('language', language);
    return firstValueFrom(
      this.http.get<QuizQuestion[]>(`${environment.apiUrl}/quiz/questions`, {
        params,
      }),
    );
  }

  submitResults(results: QuizSubmission): Promise<DiagnosticQuizResult> {
    return firstValueFrom(
      this.http.post<DiagnosticQuizResult>(
        `${environment.apiUrl}/quiz/results`,
        results,
      ),
    );
  }
}
