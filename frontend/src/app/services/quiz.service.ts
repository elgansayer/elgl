import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface QuizOption {
  id: string;
  text: string;
  points: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  skill: 'reading' | 'writing' | 'speaking' | 'listening' | 'grammar' | 'vocabulary';
  category: 'self_assessment' | 'comprehension' | 'production' | 'interaction';
  options: QuizOption[];
}

export interface QuizResultResponse {
  totalScore: number;
  maxScore: number;
  percentage: number;
  suggestedCefr: string;
  skillBreakdown: Record<string, { score: number; max: number }>;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class QuizService {
  private readonly http = inject(HttpClient);

  getQuestions(language: string): Promise<QuizQuestion[]> {
    return firstValueFrom(
      this.http.get<QuizQuestion[]>(`/api/quiz/questions?language=${language}`),
    );
  }

  evaluateResults(language: string, answers: Record<string, number>): Promise<QuizResultResponse> {
    return firstValueFrom(
      this.http.post<QuizResultResponse>('/api/quiz/evaluate', { language, answers }),
    );
  }
}
