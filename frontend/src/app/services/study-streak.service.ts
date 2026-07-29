import { Injectable, inject, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StudyStreakService {
  private http = inject(HttpClient);
  /** In-dev mock streak value that persists across calls */
  private mockStreak = isDevMode() ? 7 : 0;

  getStreak(): Observable<{ streak: number }> {
    if (isDevMode()) {
      return of({ streak: this.mockStreak });
    }
    return this.http.get<{ streak: number }>(
      `${environment.apiUrl}/study-streak/me`,
    );
  }

  checkin(): Observable<{ streak: number }> {
    if (isDevMode()) {
      this.mockStreak++;
      return of({ streak: this.mockStreak });
    }
    return this.http.post<{ streak: number }>(
      `${environment.apiUrl}/study-streak/checkin`,
      {},
    );
  }
}
