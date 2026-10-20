import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface QuizQuestion {
  id: string;
  text: string;
  options: { id: string; text: string; points: number }[];
}

export interface QuizResults {
  score: number;
  maxScore: number;
  suggestedLevel: string;
  answers: Record<string, number>;
}

@Injectable({
  providedIn: 'root',
})
export class QuizService {
  private http = inject(HttpClient);

  getQuestions(language: string): Promise<QuizQuestion[]> {
    return firstValueFrom(
      this.http.get<QuizQuestion[]>(`/api/quiz/questions?language=${language}`),
    );
  }

  submitResults(results: QuizResults): Promise<void> {
    return firstValueFrom(
      this.http.post<void>('/api/quiz/results', results),
    );
  }
}
