import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

export interface CulturalGuideResponse {
  language: string;
  guide: string;
}

@Injectable({ providedIn: 'root' })
export class CulturalGuideService {
  private readonly http = inject(HttpClient);
  readonly guide = signal<string | null>(null);

  fetchGuide(language: string): void {
    // Use resource() in real implementation; for now simple fetch
    this.http
      .get<CulturalGuideResponse>(`/api/cultural-guides/${language}`)
      .pipe(
        map((res) => res.guide),
        catchError(() => of(null)),
      )
      .subscribe((text) => this.guide.set(text ?? null));
  }
}
