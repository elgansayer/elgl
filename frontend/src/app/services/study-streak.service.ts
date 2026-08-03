import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StudyStreakService {
  private http = inject(HttpClient);

  getStreak(): Observable<{ streak: number }> {
    return this.http.get<{ streak: number }>(
      `${environment.apiUrl}/study-streak/me`,
    );
  }

  checkin(): Observable<{ streak: number }> {
    return this.http.post<{ streak: number }>(
      `${environment.apiUrl}/study-streak/checkin`,
      {},
    );
  }
}
