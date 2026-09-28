import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Lesson } from '../pages/lessons/lessons.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class LessonsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/lessons`;

  getLessons(): Observable<Lesson[]> {
    return this.http.get<Lesson[]>(this.baseUrl, { headers: this.authHeaders() });
  }

  getLesson(id: string): Observable<Lesson> {
    return this.http.get<Lesson>(`${this.baseUrl}/${encodeURIComponent(id)}`, {
      headers: this.authHeaders(),
    });
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required to load lessons');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
