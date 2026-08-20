import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  Lesson,
  LessonProgress,
  LessonProgressUpdate,
} from '../pages/lessons/lessons.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class LessonsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/lessons`;

  async listLessons(language?: string): Promise<Lesson[]> {
    let params = new HttpParams();
    if (language) params = params.set('language', language);

    return firstValueFrom(
      this.http.get<Lesson[]>(this.baseUrl, {
        headers: this.authService.getBearerHeaders(),
        params,
      }),
    );
  }

  async getLesson(id: string): Promise<Lesson> {
    return firstValueFrom(
      this.http.get<Lesson>(`${this.baseUrl}/${encodeURIComponent(id)}`, {
        headers: this.authService.getBearerHeaders(),
      }),
    );
  }

  async updateProgress(
    id: string,
    update: LessonProgressUpdate,
  ): Promise<LessonProgress> {
    return firstValueFrom(
      this.http.put<LessonProgress>(
        `${this.baseUrl}/${encodeURIComponent(id)}/progress`,
        update,
        { headers: this.authService.getBearerHeaders() },
      ),
    );
  }
}
