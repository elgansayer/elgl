import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserProfile } from './user.service';

export type MockUserPopulationSize = 'minimal' | 'medium' | 'large';

export interface MockUserPopulationResponse {
  schemaVersion: 'mock-user-population-v1';
  namespace: string;
  size: MockUserPopulationSize;
  count: number;
  seed: number;
  seedId: string;
  profiles: UserProfile[];
}

@Injectable({ providedIn: 'root' })
export class MockUserPopulationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/mock/users`;

  load(
    size: MockUserPopulationSize = 'medium',
    namespace = 'frontend',
  ): Observable<MockUserPopulationResponse> {
    if (environment.production) {
      return throwError(
        () => new Error('Mock user population is unavailable in production'),
      );
    }

    const params = new HttpParams()
      .set('size', size)
      .set('namespace', namespace);
    return this.http.get<MockUserPopulationResponse>(this.baseUrl, { params });
  }
}
