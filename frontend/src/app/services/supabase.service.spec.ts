import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  const configure = () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  };

  it('defers reading browser runtime configuration until the client is used', () => {
    configure();
    const supabaseUrl = vi.fn(() => 'https://test.supabase.co');
    const supabaseAnonKey = vi.fn(() => 'test-anon-key');
    Object.defineProperties(environment, {
      supabaseUrl: { configurable: true, get: supabaseUrl },
      supabaseAnonKey: { configurable: true, get: supabaseAnonKey },
    });
    const service = TestBed.inject(SupabaseService);

    expect(supabaseUrl).not.toHaveBeenCalled();
    expect(supabaseAnonKey).not.toHaveBeenCalled();

    const client = service.getClient();

    expect(supabaseUrl).toHaveBeenCalledTimes(1);
    expect(supabaseAnonKey).toHaveBeenCalledTimes(1);
    expect(service.getClient()).toBe(client);
    expect(supabaseUrl).toHaveBeenCalledTimes(1);
    expect(supabaseAnonKey).toHaveBeenCalledTimes(1);
  });

  describe('API-first data access', () => {
    let service: SupabaseService;
    let http: HttpTestingController;

    beforeEach(() => {
      configure();
      service = TestBed.inject(SupabaseService);
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('loads recently joined speakers through the users API', async () => {
      const promise = service.getRecentlyJoinedNativeSpeakers(5);
      const request = http.expectOne(
        (candidate) =>
          candidate.url === `${environment.apiUrl}/discovery/recent-native-speakers`,
      );
      expect(request.request.method).toBe('GET');
      expect(request.request.params.get('limit')).toBe('5');
      request.flush([{ id: 'user-1' }]);

      await expect(promise).resolves.toEqual([{ id: 'user-1' }]);
    });

    it('returns an empty list when the speakers API fails', async () => {
      const promise = service.getRecentlyJoinedNativeSpeakers();
      http
        .expectOne(
          (candidate) =>
            candidate.url ===
            `${environment.apiUrl}/discovery/recent-native-speakers`,
        )
        .error(new ProgressEvent('error'));

      await expect(promise).resolves.toEqual([]);
    });

    it('reads the daily streak from the study-streak API', async () => {
      const promise = service.getDailyStreak();
      const request = http.expectOne(
        `${environment.apiUrl}/study-streak/me`,
      );
      expect(request.request.method).toBe('GET');
      request.flush({ streak: 12 });

      await expect(promise).resolves.toBe(12);
    });

    it('reads earned badges from the authenticated profile API', async () => {
      const promise = service.getEarnedBadges();
      const request = http.expectOne(`${environment.apiUrl}/users/me`);
      request.flush({
        is_vip: true,
        vip_tier: 'developer_20_ukp_26_usd',
        is_serious_learner: true,
      });

      await expect(promise).resolves.toEqual({
        isVip: true,
        vipTier: 'developer_20_ukp_26_usd',
        isSeriousLearner: true,
      });
    });

    it('fails closed to a free profile when the badge lookup fails', async () => {
      const promise = service.getEarnedBadges();
      http
        .expectOne(`${environment.apiUrl}/users/me`)
        .error(new ProgressEvent('error'));

      await expect(promise).resolves.toEqual({
        isVip: false,
        vipTier: 'free',
        isSeriousLearner: false,
      });
    });
  });
});
