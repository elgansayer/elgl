import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, catchError, of, timeout, retry, Subject, takeUntil } from 'rxjs';
import { MOCK_PARTNERS } from './mock-data';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { UserProfile, UserService } from './user.service';
import { ChatService, ChatMessage } from './chat.service';
import { OfflineDiscoveryCacheService } from './offline-discovery-cache.service';
import { MatchmakingAlgorithmService } from './matchmaking-algorithm.service';

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
  private matchmakingAlgorithm = inject(MatchmakingAlgorithmService);
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

  async findPartners(
    filters: SearchFilterParams & { serious_learner_mode?: boolean },
    abortSignal?: AbortSignal,
  ): Promise<UserProfile[]> {
    const hasLocationPair = filters.latitude !== undefined && filters.longitude !== undefined;
    const cacheFilters = Object.fromEntries(
      Object.entries(filters).filter(
        ([key, value]) => value !== undefined && key !== 'latitude' && key !== 'longitude',
      ),
    );
    if (hasLocationPair) cacheFilters['location_cache_scope'] = 'nearby-memory-origin';
    const filtersKey = this.offlineCache.buildFiltersKey(cacheFilters);
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

    if (filters.has_audio_intro !== undefined)
      params = params.set('has_audio_intro', filters.has_audio_intro.toString());

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

    // Offline-first: attempt cached results before making network request
    if (!isOnline) {
      const cached = await this.offlineCache.getCachedSearchResults(filtersKey);
      if (cached && cached.length > 0) {
        return this.enrichPartnersFallback(cached, filters);
      }
      // Fall back to all cached partners and apply client-side matchmaking algorithm
      const allCached = await this.offlineCache.getAllCachedPartners();
      if (allCached.length > 0) {
        return this.enrichPartnersFallback(allCached, filters);
      }
      // Ultimate fallback: mock data with algorithm-based ranking
      const currentUser = this.authService.currentUser();
      if (currentUser?.id) {
        const profile = await this.userService.getMyProfile().catch((): UserProfile | null => null);
        if (profile) {
          const scored = this.matchmakingAlgorithm.scoreAndRank(profile, MOCK_PARTNERS);
          const scoreFiltered = this.matchmakingAlgorithm.applyOfflineFilters(scored.data, filters);
          const fallbackUsers = scoreFiltered.data.map((s) => s.partner);
          return this.enrichPartnersFallback(fallbackUsers, filters);
        }
      }
      return MOCK_PARTNERS;
    }

    // Build cancellation notifier from AbortSignal
    const cancel$ = new Subject<void>();
    if (abortSignal) {
      if (abortSignal.aborted) {
        return MOCK_PARTNERS;
      }
      abortSignal.addEventListener('abort', () => cancel$.next(), { once: true });
    }

    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/partners`, { headers: this.getHeaders(), params })
        .pipe(
          timeout(15000),
          retry({ count: 1, delay: 1000 }),
          takeUntil(cancel$),
          catchError(() => of<UserProfile[]>(MOCK_PARTNERS)),
        ),
    );

    // Cache the fresh results for offline use
    if (users !== MOCK_PARTNERS) {
      void this.offlineCache.cacheSearchResults(filtersKey, users);
      void this.offlineCache.cachePartners(users);
    }

    return this.enrichPartners(users, filters);
  }

  private async enrichPartners(
    users: UserProfile[],
    filters: SearchFilterParams & { serious_learner_mode?: boolean },
  ): Promise<UserProfile[]> {
    // Filter out blocked users client-side
    const currentUser = this.authService.currentUser();
    let filtered = users;
    if (currentUser?.id) {
      const blockedIds = await this.safetyService
        .getBlockedAndBlockerIds(currentUser.id)
        .catch((): string[] => []);
      if (blockedIds.length > 0) {
        filtered = filtered.filter((user) => !blockedIds.includes(user.id));
      }
    }

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

  /**
   * Offline enrichment path that uses client-side matchmaking algorithm to
   * score and rank cached partners. Skips server-dependent operations
   * (partner-of-week flags) but still filters blocked users from cached data.
   */
  private async enrichPartnersFallback(
    users: UserProfile[],
    filters: SearchFilterParams & { serious_learner_mode?: boolean },
  ): Promise<UserProfile[]> {
    const currentUser = this.authService.currentUser();

    // Filter out blocked users from cached data
    let filtered = users;
    if (currentUser?.id) {
      const blockedIds = await this.safetyService
        .getBlockedAndBlockerIds(currentUser.id)
        .catch((): string[] => []);
      if (blockedIds.length > 0) {
        filtered = filtered.filter((user) => !blockedIds.includes(user.id));
      }
    }

    // Apply client-side matchmaking algorithm scoring when we have user profile data
    if (currentUser?.id) {
      const profile = await this.userService.getMyProfile().catch((): UserProfile | null => null);
      if (profile) {
        const scored = this.matchmakingAlgorithm.scoreAndRank(profile, filtered);
        const rankFiltered = this.matchmakingAlgorithm.applyOfflineFilters(scored.data, filters);
        return rankFiltered.data.map((s) => s.partner);
      }
    }

    return filtered;
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
        .pipe(catchError(() => of<UserProfile[]>(MOCK_PARTNERS))),
    );
    return users;
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
    const currentUser = this.authService.currentUser();
    let filtered = users;
    if (currentUser?.id) {
      const blockedIds = await this.safetyService
        .getBlockedAndBlockerIds(currentUser.id)
        .catch((): string[] => []);
      if (blockedIds.length > 0) {
        filtered = filtered.filter((user) => !blockedIds.includes(user.id));
      }
    }
    return filtered;
  }

  async getRecentNativeSpeakers(): Promise<UserProfile[]> {
    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/recent-native-speakers`, {
          headers: this.getHeaders(),
        })
        .pipe(catchError(() => of<UserProfile[]>([]))),
    );
    const currentUser = this.authService.currentUser();
    let filtered = users;
    if (currentUser?.id) {
      const blockedIds = await this.safetyService
        .getBlockedAndBlockerIds(currentUser.id)
        .catch((): string[] => []);
      if (blockedIds.length > 0) {
        filtered = filtered.filter((user) => !blockedIds.includes(user.id));
      }
    }
    return filtered;
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
      const currentUser = this.authService.currentUser();
      let filtered = users;
      if (currentUser?.id) {
        const blockedIds = await this.safetyService
          .getBlockedAndBlockerIds(currentUser.id)
          .catch((): string[] => []);
        if (blockedIds.length > 0) {
          filtered = filtered.filter((user) => !blockedIds.includes(user.id));
        }
      }
      return filtered;
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
    const currentUser = this.authService.currentUser();
    let filtered = users;
    if (currentUser?.id) {
      const blockedIds = await this.safetyService
        .getBlockedAndBlockerIds(currentUser.id)
        .catch((): string[] => []);
      if (blockedIds.length > 0) {
        filtered = filtered.filter((user) => !blockedIds.includes(user.id));
      }
    }
    return filtered;
  }

  async translateBio(targetUserId: string, targetLanguage: string): Promise<string> {
    try {
      const result = await firstValueFrom(
        this.http.post<{ translated_text: string }>(
          `${environment.apiUrl}/nlp/translate-bio`,
          { target_user_id: targetUserId, target_language: targetLanguage },
          { headers: this.getHeaders() }
        )
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
