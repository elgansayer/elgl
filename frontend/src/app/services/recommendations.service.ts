import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type RecommendationReason =
  | 'language_exchange'
  | 'shared_interests'
  | 'active_recently'
  | 'study_streak';

export interface DiscoveryRecommendation {
  id: string;
  display_name: string;
  avatar_url: string | null;
  native_languages: string[];
  target_languages: string[];
  shared_interest_count: number;
  recommendation_reasons: RecommendationReason[];
}

@Injectable({ providedIn: 'root' })
export class RecommendationsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/recommendations`;

  async getDiscoveryRecommendations(): Promise<DiscoveryRecommendation[]> {
    const token = this.authService.getAccessToken();
    return firstValueFrom(
      this.http
        .get<DiscoveryRecommendation[]>(`${this.baseUrl}/discovery`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        })
        .pipe(timeout(15_000)),
    );
  }
}
