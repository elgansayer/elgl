import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  content_json?: Record<string, unknown>;
  language_code: string;
  difficulty_level?: number;
  cover_image_url?: string;
  audio_url?: string;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class LessonService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/admin/lessons`;
  private uploadBaseUrl = `${environment.apiUrl}/media/upload`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  async listLessons(): Promise<Lesson[]> {
    return firstValueFrom(
      this.http.get<Lesson[]>(this.baseUrl, { headers: this.getHeaders() }),
    );
  }

  async getLesson(id: string): Promise<Lesson> {
    return firstValueFrom(
      this.http.get<Lesson>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() }),
    );
  }

  async createLesson(lesson: Partial<Lesson>): Promise<Lesson> {
    return firstValueFrom(
      this.http.post<Lesson>(this.baseUrl, lesson, { headers: this.getHeaders() }),
    );
  }

  async updateLesson(id: string, lesson: Partial<Lesson>): Promise<Lesson> {
    return firstValueFrom(
      this.http.patch<Lesson>(`${this.baseUrl}/${id}`, lesson, { headers: this.getHeaders() }),
    );
  }

  async deleteLesson(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/${id}`, { headers: this.getHeaders() }),
    );
  }

  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const result = await firstValueFrom(
      this.http.post<{ url: string }>(this.uploadBaseUrl, formData, {
        headers: this.getHeaders(),
      }),
    );
    return result.url;
  }
}
