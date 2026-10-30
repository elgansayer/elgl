import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  firstValueFrom,
  catchError,
  of,
  timeout,
  timer,
  throwError,
  retry,
  Subject,
  takeUntil,
} from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { UserProfile, UserService } from './user.service';
import { ChatService, ChatMessage } from './chat.service';
import { OfflineDiscoveryCacheService } from './offline-discovery-cache.service';

export interface SearchFilterParams {
  latitude?: number;
  longitude?: number;
  radius_metres?: number;
  native_languages?: string;
  target_language?: string;
  serious_learner_only?: boolean;
  proficiency_level?: string;
  gender?: string;
  age_min?: number;
  age_max?: number;
  interests?: string;
  sort?: string;
  has_audio_intro?: boolean;
  country?: string;
  city?: string;
  serious_learner_mode?: boolean;
  learning_goals?: string;
  learning_goals_mode?: string;
  availability_morning?: boolean;
  availability_afternoon?: boolean;
  availability_evening?: boolean;
  available_time_start?: string;
  available_time_end?: string;
  voice_room_active?: boolean;
}

/** Why a partner search could not be answered. Each class gets its own honest UI state. */
export type DiscoverySearchFailureKind =
  'unauthorised' | 'rate_limited' | 'invalid_request' | 'unavailable';

/**
 * Sanitised partner-search failure.
 *
 * It carries only the failure class and the HTTP status. An HttpErrorResponse
 * embeds the request URL and, for Nearby searches, that URL holds the caller's
 * precise coordinates, so the raw error must never reach a log or an error report.
 */
export class DiscoverySearchError extends Error {
  constructor(
    readonly kind: DiscoverySearchFailureKind,
    readonly status: number | null = null,
  ) {
    super(`Discovery search failed: ${kind}`);
    this.name = 'DiscoverySearchError';
  }
}

function classifyPartnerSearchFailure(error: unknown): DiscoverySearchError {
  if (error instanceof HttpErrorResponse) {
    const status = error.status > 0 ? error.status : null;
    if (error.status === 401 || error.status === 403) {
      return new DiscoverySearchError('unauthorised', status);
    }
    if (error.status === 429) return new DiscoverySearchError('rate_limited', status);
    if (error.status === 400 || error.status === 422) {
      return new DiscoverySearchError('invalid_request', status);
    }
    return new DiscoverySearchError('unavailable', status);
  }
  // Timeouts and transport failures never reach a server decision, so the user can simply retry.
  return new DiscoverySearchError('unavailable');
}

/**
 * Only transport failures, timeouts and 5xx responses merit an automatic retry. A 4xx will not
 * change on repeat, and 429 is already retried with back-off and Retry-After by the app-level
 * interceptor, so retrying it again here would multiply requests against the rate limit.
 */
function isTransientPartnerSearchFailure(error: unknown): boolean {
  return !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
}

@Injectable({
  providedIn: 'root',
})
export class DiscoveryService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);
  private chatService = inject(ChatService);
  private userService = inject(UserService);
  private offlineCache = inject(OfflineDiscoveryCacheService);
  private baseUrl = `${environment.apiUrl}/discovery`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  private readonly PROFICIENCY_LEVEL_MAP: Record<string, string> = {
    beginner: 'A1',
    intermediate: 'B1',
    advanced: 'C1',
  };

  private async getPartnerOfWeekIds(): Promise<string[]> {
    try {
      return await firstValueFrom(
        this.http.get<string[]>(`${this.baseUrl}/partner-of-week`, {
          headers: this.getHeaders(),
        }),
      );
    } catch {
      return [];
    }
  }

  /**
   * Searches partners through `GET /discovery/partners`.
   *
   * Resolves to `[]` for an offline client, a cancelled request, an unverifiable block graph, or a
   * genuinely empty result. Rejects with a {@link DiscoverySearchError} when the API itself cannot
   * answer (401/403, 429, 400/422, 5xx, timeout, transport failure) so callers can show an
   * unavailable state instead of a misleading "no matches".
   */
  async findPartners(
    filters: SearchFilterParams & { serious_learner_mode?: boolean },
    abortSignal?: AbortSignal,
  ): Promise<UserProfile[]> {
    const isOnline = this.offlineCache.isOnline();

    let params = new HttpParams();
    if (filters.latitude !== undefined)
      params = params.set('latitude', filters.latitude.toString());
    if (filters.longitude !== undefined)
      params = params.set('longitude', filters.longitude.toString());
    if (filters.radius_metres !== undefined)
      params = params.set('radius_metres', filters.radius_metres.toString());
    if (filters.native_languages) params = params.set('native_languages', filters.native_languages);
    if (filters.target_language) params = params.set('target_language', filters.target_language);
    if (filters.serious_learner_only !== undefined)
      params = params.set('serious_learner_only', filters.serious_learner_only.toString());
    if (filters.proficiency_level) {
      const mappedLevel =
        this.PROFICIENCY_LEVEL_MAP[filters.proficiency_level.toLowerCase()] ??
        filters.proficiency_level;
      params = params.set('level', mappedLevel);
    }
    if (filters.gender) params = params.set('gender', filters.gender);
    if (filters.age_min !== undefined) params = params.set('age_min', filters.age_min.toString());
    if (filters.age_max !== undefined) params = params.set('age_max', filters.age_max.toString());
    if (filters.interests) params = params.set('interests', filters.interests);

    if (filters.sort) params = params.set('sort', filters.sort);

    if (filters.has_audio_intro === true) params = params.set('has_audio_intro', 'true');

    if (filters.country !== undefined) params = params.set('country', filters.country);

    if (filters.city !== undefined) params = params.set('city', filters.city);

    if (filters.serious_learner_mode !== undefined)
      params = params.set('serious_learner_mode', filters.serious_learner_mode.toString());

    if (filters.learning_goals !== undefined)
      params = params.set('learning_goals', filters.learning_goals);

    if (filters.learning_goals_mode !== undefined)
      params = params.set('learning_goals_mode', filters.learning_goals_mode);

    if (filters.availability_morning !== undefined)
      params = params.set('availability_morning', filters.availability_morning.toString());

    if (filters.availability_afternoon !== undefined)
      params = params.set('availability_afternoon', filters.availability_afternoon.toString());

    if (filters.availability_evening !== undefined)
      params = params.set('availability_evening', filters.availability_evening.toString());

    if (filters.available_time_start !== undefined)
      params = params.set('available_time_start', filters.available_time_start);
    if (filters.available_time_end !== undefined)
      params = params.set('available_time_end', filters.available_time_end);
    if (filters.voice_room_active !== undefined)
      params = params.set('voice_room_active', filters.voice_room_active.toString());

    // Discovery visibility depends on current privacy, deletion, and block
    // state. None of those security boundaries can be revalidated offline, so
    // never serve persisted or synthetic profiles without the API.
    if (!isOnline) {
      return [];
    }

    // Build cancellation notifier from AbortSignal
    const cancel$ = new Subject<void>();
    if (abortSignal) {
      if (abortSignal.aborted) {
        return [];
      }
      abortSignal.addEventListener('abort', () => cancel$.next(), { once: true });
    }

    let users: UserProfile[];
    try {
      users = await firstValueFrom(
        this.http
          .get<UserProfile[]>(`${this.baseUrl}/partners`, { headers: this.getHeaders(), params })
          .pipe(
            timeout(15000),
            retry({
              count: 1,
              delay: (error: unknown) =>
                isTransientPartnerSearchFailure(error) ? timer(1000) : throwError(() => error),
            }),
            takeUntil(cancel$),
          ),
        // A cancelled request completes without a value; that is a superseded search, not a failure.
        { defaultValue: [] },
      );
    } catch (error) {
      if (abortSignal?.aborted) return [];
      // Surface the failure instead of an empty list: "the service is unavailable" and "nobody
      // matches" need different UI. Offline and block-graph failures stay fail-closed (empty).
      throw classifyPartnerSearchFailure(error);
    }

    return this.enrichPartners(users, filters);
  }

  private async enrichPartners(
    users: UserProfile[],
    filters: SearchFilterParams & { serious_learner_mode?: boolean },
  ): Promise<UserProfile[]> {
    const filtered = this.applyRequiredFilters(
      await this.filterByVerifiedBlockGraph(users),
      filters,
    );
    if (filtered.length === 0) return [];

    // Attach is_partner_of_week flag using separate endpoint
    const partnerIds = await this.getPartnerOfWeekIds();
    const partnerSet = new Set(partnerIds);
    let enriched = filtered.map((user) => ({
      ...user,
      is_partner_of_week: partnerSet.has(user.id),
    }));

    // Apply serious_learner_only filter if requested
    if (filters.serious_learner_only) {
      function hasSeriousLearner(
        user: UserProfile,
      ): user is UserProfile & { is_serious_learner: boolean } {
        return 'is_serious_learner' in user;
      }
      enriched = enriched.filter((user) => hasSeriousLearner(user) && user.is_serious_learner);
    }

    return enriched;
  }

  private async filterByVerifiedBlockGraph(users: UserProfile[]): Promise<UserProfile[]> {
    if (users.length === 0) return [];

    const currentUser = this.authService.currentUser();
    if (!currentUser?.id) return [];

    try {
      const blockedIds = await this.safetyService.getBlockedAndBlockerIdsStrict(currentUser.id);
      if (blockedIds.length === 0) return users;
      const blockedSet = new Set(blockedIds);
      return users.filter((user) => !blockedSet.has(user.id));
    } catch {
      return [];
    }
  }

  private applyRequiredFilters(users: UserProfile[], filters: SearchFilterParams): UserProfile[] {
    if (filters.has_audio_intro !== true) return users;

    return users.filter((user) => Boolean(user.audio_intro_url?.trim()));
  }

  async searchByCountryCity(country?: string, city?: string): Promise<UserProfile[]> {
    let params = new HttpParams();
    if (country?.trim()) {
      params = params.set('country', country.trim());
    }
    if (city?.trim()) {
      params = params.set('city', city.trim());
    }
    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/search-by-location`, {
          headers: this.getHeaders(),
          params,
        })
        .pipe(catchError(() => of<UserProfile[]>([]))),
    );
    return this.filterByVerifiedBlockGraph(users);
  }

  async getAudioIntros(filters?: SearchFilterParams): Promise<UserProfile[]> {
    let params = new HttpParams();
    if (filters?.native_languages)
      params = params.set('native_languages', filters.native_languages);
    if (filters?.target_language) params = params.set('target_language', filters.target_language);
    if (filters?.proficiency_level) {
      const mappedLevel =
        this.PROFICIENCY_LEVEL_MAP[filters.proficiency_level.toLowerCase()] ??
        filters.proficiency_level;
      params = params.set('level', mappedLevel);
    }
    if (filters?.country !== undefined) params = params.set('country', filters.country);
    if (filters?.city !== undefined) params = params.set('city', filters.city);
    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/audio-intros`, {
          headers: this.getHeaders(),
          params,
        })
        .pipe(catchError(() => of<UserProfile[]>([]))),
    );
    return this.filterByVerifiedBlockGraph(users);
  }

  async getRecentNativeSpeakers(): Promise<UserProfile[]> {
    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/recent-native-speakers`, {
          headers: this.getHeaders(),
        })
        .pipe(catchError(() => of<UserProfile[]>([]))),
    );
    return this.filterByVerifiedBlockGraph(users);
  }

  async getSpotlightUsers(): Promise<UserProfile[]> {
    try {
      const users = await firstValueFrom(
        this.http
          .get<UserProfile[]>(`${this.baseUrl}/spotlight`, {
            headers: this.getHeaders(),
          })
          .pipe(catchError(() => of<UserProfile[]>([]))),
      );
      return this.filterByVerifiedBlockGraph(users);
    } catch {
      return [];
    }
  }

  async findByLanguagePair(
    nativeLanguage?: string,
    targetLanguage?: string,
    country?: string,
    city?: string,
    proficiencyLevel?: string,
  ): Promise<UserProfile[]> {
    let params = new HttpParams();
    if (nativeLanguage) params = params.set('native_language', nativeLanguage);
    if (targetLanguage) params = params.set('target_language', targetLanguage);
    if (country) params = params.set('country', country);
    if (city) params = params.set('city', city);
    if (proficiencyLevel) {
      const mappedLevel =
        this.PROFICIENCY_LEVEL_MAP[proficiencyLevel.toLowerCase()] ?? proficiencyLevel;
      params = params.set('level', mappedLevel);
    }
    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/language-pair`, {
          headers: this.getHeaders(),
          params,
        })
        .pipe(catchError(() => of<UserProfile[]>([]))),
    );
    return this.filterByVerifiedBlockGraph(users);
  }

  async translateBio(targetUserId: string, targetLanguage: string): Promise<string> {
    try {
      const result = await firstValueFrom(
        this.http.post<{ translated_text: string }>(
          `${environment.apiUrl}/nlp/translate-bio`,
          { target_user_id: targetUserId, target_language: targetLanguage },
          { headers: this.getHeaders() },
        ),
      );
      return result.translated_text;
    } catch {
      return '';
    }
  }

  async sendMessageToPartner(partnerId: string, message: string): Promise<ChatMessage> {
    const currentUser = this.authService.currentUser();
    if (!currentUser?.id) throw new Error('Not authenticated');
    // Create a 1-on-1 private room with the partner
    const newRoom = await this.chatService.createGroup('', [partnerId]);
    return this.chatService.sendMessage({
      room_id: newRoom.id,
      message_type: 'text',
      text_content: message,
    });
  }

  async followPartner(partnerId: string): Promise<void> {
    return this.userService.followUser(partnerId);
  }
}
