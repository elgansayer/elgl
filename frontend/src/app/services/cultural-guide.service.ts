import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CulturalGuideResponse {
  language: string;
  guide: string;
}

@Injectable({ providedIn: 'root' })
export class CulturalGuideService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/cultural-guides`;

  async fetchGuide(language: string): Promise<string | null> {
    const response = await firstValueFrom(
      this.http
        .get<CulturalGuideResponse>(`${this.apiUrl}/${language}`)
        .pipe(catchError(() => of(null))),
    );
    return response?.guide ?? null;
  }
}
