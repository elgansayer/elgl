import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

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
}
