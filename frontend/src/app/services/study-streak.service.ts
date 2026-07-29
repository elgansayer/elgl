import { Injectable, inject, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StudyStreakService {
  private http = inject(HttpClient);

  getStreak(): Observable<{ streak: number }> {
    if (isDevMode()) {
      return of({ streak: 7 });
    }
    return this.http.get<{ streak: number }>(
      `${environment.apiUrl}/study-streak/me`,
    );
  }

  checkin(): Observable<{ streak: number }> {
    if (isDevMode()) {
      return of({ streak: 8 });
    }
    return this.http.post<{ streak: number }>(
      `${environment.apiUrl}/study-streak/checkin`,
      {},
    );
  }
}
