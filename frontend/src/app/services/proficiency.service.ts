import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AssessmentResultDto {
  userId: string;
  grammarScore?: number;
  vocabularyScore?: number;
  pronunciationScore?: number;
}

export interface AssessmentResult {
  level: string;
  overallScore: number;
  grammarScore: number;
  vocabularyScore: number;
  pronunciationScore: number;
  testedAt: string;
}

export type ProficiencyLevel =
  | 'A1'
  | 'A2'
  | 'B1'
  | 'B2'
  | 'C1'
  | 'C2';

export function isProficiencyLevel(value: string): value is ProficiencyLevel {
  switch (value) {
    case 'A1':
    case 'A2':
    case 'B1':
    case 'B2':
    case 'C1':
    case 'C2':
      return true;
    default:
      return false;
  }
}

export interface TargetLanguageLevel {
  language: string;
  level: ProficiencyLevel;
}

export interface LanguageSelectionDto {
  userId: string;
  nativeLanguage: string;
  targetLanguages: TargetLanguageLevel[];
}

@Injectable({
  providedIn: 'root',
})
export class ProficiencyService {
  private http = inject(HttpClient);

  assess(dto: AssessmentResultDto) {
    return this.http.post<AssessmentResult>(
      `${environment.apiUrl}/proficiency/assess`,
      dto,
    );
  }

  setLanguagePreferences(
    dto: LanguageSelectionDto,
  ): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${environment.apiUrl}/proficiency/languages`,
      dto,
    );
  }
}
