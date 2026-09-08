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

const DISCOVERY_RECOMMENDATION_LIMIT = 10;
const MAX_PROFILE_ID_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MAX_AVATAR_URL_LENGTH = 2048;
const MAX_LANGUAGE_ITEMS = 8;
const MAX_LANGUAGE_LENGTH = 35;
const ALLOWED_REASONS = new Set<RecommendationReason>([
  'language_exchange',
  'shared_interests',
  'active_recently',
  'study_streak',
]);

function invalidResponse(): never {
  // Deliberately avoid including server payloads in the error: recommendation
  // responses contain profile data and may be surfaced by client diagnostics.
  throw new Error('Invalid discovery recommendation response');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBoundedText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') invalidResponse();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[\u0000-\u001f\u007f]/u.test(trimmed)) {
    invalidResponse();
  }
  return trimmed;
}

function parseAvatarUrl(value: unknown): string | null {
  if (value === null) return null;
  const url = parseBoundedText(value, MAX_AVATAR_URL_LENGTH);

  try {
    const parsed = new URL(url);
    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      parsed.username ||
      parsed.password
    ) {
      invalidResponse();
    }
  } catch {
    invalidResponse();
  }

  return url;
}

function parseLanguages(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_LANGUAGE_ITEMS) {
    invalidResponse();
  }

  const languages = value.map((language) => parseBoundedText(language, MAX_LANGUAGE_LENGTH));
  if (new Set(languages).size !== languages.length) invalidResponse();
  return languages;
}

function parseReasons(value: unknown): RecommendationReason[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > ALLOWED_REASONS.size) {
    invalidResponse();
  }

  const reasons: RecommendationReason[] = [];
  for (const reason of value) {
    if (typeof reason !== 'string' || !ALLOWED_REASONS.has(reason as RecommendationReason)) {
      invalidResponse();
    }
    reasons.push(reason as RecommendationReason);
  }

  if (new Set(reasons).size !== reasons.length) invalidResponse();
  return reasons;
}

function parseDiscoveryRecommendation(value: unknown): DiscoveryRecommendation {
  if (!isRecord(value)) invalidResponse();

  const sharedInterestCount = value['shared_interest_count'];
  if (
    typeof sharedInterestCount !== 'number' ||
    !Number.isInteger(sharedInterestCount) ||
    sharedInterestCount < 0 ||
    sharedInterestCount > 3
  ) {
    invalidResponse();
  }

  return {
    id: parseBoundedText(value['id'], MAX_PROFILE_ID_LENGTH),
    display_name: parseBoundedText(value['display_name'], MAX_DISPLAY_NAME_LENGTH),
    avatar_url: parseAvatarUrl(value['avatar_url']),
    native_languages: parseLanguages(value['native_languages']),
    target_languages: parseLanguages(value['target_languages']),
    shared_interest_count: sharedInterestCount,
    recommendation_reasons: parseReasons(value['recommendation_reasons']),
  };
}

export function parseDiscoveryRecommendations(value: unknown): DiscoveryRecommendation[] {
  if (!Array.isArray(value) || value.length > DISCOVERY_RECOMMENDATION_LIMIT) {
    invalidResponse();
  }

  const recommendations = value.map(parseDiscoveryRecommendation);
  const ids = new Set(recommendations.map((recommendation) => recommendation.id));
  if (ids.size !== recommendations.length) invalidResponse();
  return recommendations;
}

@Injectable({ providedIn: 'root' })
export class RecommendationsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/recommendations`;

  async getDiscoveryRecommendations(): Promise<DiscoveryRecommendation[]> {
    const token = this.authService.getAccessToken()?.trim();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await firstValueFrom(
      this.http
        .get<unknown>(`${this.baseUrl}/discovery`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .pipe(timeout(15_000)),
    );

    return parseDiscoveryRecommendations(response);
  }
}
