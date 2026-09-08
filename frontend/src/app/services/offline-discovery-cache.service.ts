import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';
import { UserProfile } from './user.service';

const DB_NAME = 'hellotalk_discovery_cache';

/**
 * Discovery profiles are intentionally never available offline.
 *
 * Whether a profile may be discovered depends on current privacy, deletion,
 * and bidirectional block state. Persisted profiles cannot be revalidated
 * while offline, so this compatibility service purges the legacy IndexedDB
 * cache and keeps the old API as fail-closed no-ops for existing consumers.
 */
@Injectable({
  providedIn: 'root',
})
export class OfflineDiscoveryCacheService {
  private readonly networkStatus = inject(NetworkStatusService);

  readonly isOnline = this.networkStatus.isOnline;
  readonly cachedDataAvailable = signal(false);

  private async purgeLegacyCache(): Promise<void> {
    this.cachedDataAvailable.set(false);
    if (typeof window === 'undefined' || !window.indexedDB) return;

    await new Promise<void>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.deleteDatabase(DB_NAME);
      } catch {
        resolve();
        return;
      }
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }

  async cachePartner(_partner: UserProfile): Promise<void> {
    return Promise.resolve();
  }

  async cachePartners(_partners: UserProfile[]): Promise<void> {
    return Promise.resolve();
  }

  async getCachedPartner(_partnerId: string): Promise<UserProfile | null> {
    return null;
  }

  async getAllCachedPartners(): Promise<UserProfile[]> {
    return [];
  }

  async cacheSearchResults(_filtersKey: string, _partners: UserProfile[]): Promise<void> {
    return Promise.resolve();
  }

  async getCachedSearchResults(_filtersKey: string): Promise<UserProfile[] | null> {
    return null;
  }

  /** Retained for callers that use it as a stable request key. */
  buildFiltersKey(params: Record<string, unknown>): string {
    const sorted = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('&');
    return sorted || 'default';
  }

  async clearAll(): Promise<void> {
    await this.purgeLegacyCache();
  }

  async evictStaleEntries(): Promise<void> {
    await this.purgeLegacyCache();
  }
}

/** Ensure legacy discovery profiles are purged during every browser bootstrap. */
export function initialiseOfflineDiscoveryCache(): () => Promise<void> {
  const cache = inject(OfflineDiscoveryCacheService);
  return () => cache.clearAll();
}
