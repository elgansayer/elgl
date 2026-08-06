import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class StudyStreakService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  getStreak(): Observable<{ streak: number }> {
    const token = this.authService.getAccessToken();
    if (!token) return of({ streak: 0 });

    return this.http.get<{ streak: number }>(`${environment.apiUrl}/study-streak/me`, {
      headers: this.getHeaders(),
    });
  }

  checkin(): Observable<{ streak: number }> {
    const token = this.authService.getAccessToken();
    if (!token) return of({ streak: 0 });

    return this.http.post<{ streak: number }>(
      `${environment.apiUrl}/study-streak/checkin`,
      {},
      { headers: this.getHeaders() },
    );
  }
}
