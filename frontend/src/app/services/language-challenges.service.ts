import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type LanguageChallengeStatus = 'open' | 'completed' | 'cancelled';
export type ChallengeParticipantStatus = 'active' | 'completed' | 'failed' | null;

export interface LanguageChallenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  entry_fee_coins: number;
  duration_days: number;
  challenge_type: 'streak' | 'points';
  prize_pool_coins: number;
  status: LanguageChallengeStatus;
  starts_at: string;
  ends_at: string;
  completed_at: string | null;
  created_at: string;
  joined: boolean;
  participant_status: ChallengeParticipantStatus;
  progress_days: number;
  prize_coins: number;
  ended: boolean;
}

export interface CreateLanguageChallengeRequest {
  title: string;
  description: string;
  entryFeeCoins: number;
  durationDays: number;
  challengeType?: 'streak' | 'points';
}

export interface JoinChallengeResult {
  joined: boolean;
  alreadyJoined: boolean;
  coinsRemaining: number;
  prizePoolCoins: number;
}

export interface ChallengeCheckinResult {
  checkedIn: boolean;
  alreadyCheckedIn: boolean;
  progressDays: number;
  targetDays: number;
  activityDate: string;
}

export interface ChallengeClaimResult {
  claimed: boolean;
  alreadySettled: boolean;
  prizeCoins: number;
  winnerCount?: number;
  remainderCoins?: number;
}

@Injectable({ providedIn: 'root' })
export class LanguageChallengesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/language-challenges`;

  list(limit = 20, offset = 0): Promise<LanguageChallenge[]> {
    const params = new HttpParams()
      .set('limit', String(Math.max(1, Math.min(50, limit))))
      .set('offset', String(Math.max(0, offset)));
    return firstValueFrom(this.http.get<LanguageChallenge[]>(this.baseUrl, { params }));
  }

  create(request: CreateLanguageChallengeRequest): Promise<LanguageChallenge> {
    return firstValueFrom(this.http.post<LanguageChallenge>(this.baseUrl, request));
  }

  join(challengeId: string): Promise<JoinChallengeResult> {
    return firstValueFrom(
      this.http.post<JoinChallengeResult>(`${this.baseUrl}/${encodeURIComponent(challengeId)}/join`, {}),
    );
  }

  checkIn(challengeId: string): Promise<ChallengeCheckinResult> {
    return firstValueFrom(
      this.http.post<ChallengeCheckinResult>(
        `${this.baseUrl}/${encodeURIComponent(challengeId)}/daily-checkin`,
        {},
      ),
    );
  }

  claim(challengeId: string): Promise<ChallengeClaimResult> {
    return firstValueFrom(
      this.http.post<ChallengeClaimResult>(
        `${this.baseUrl}/${encodeURIComponent(challengeId)}/claim`,
        {},
      ),
    );
  }
}
