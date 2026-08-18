import { Injectable, signal } from '@angular/core';

const CELLULAR_AUTO_DOWNLOAD_KEY = 'hellotalk_cellular_auto_download';

function loadCellularPreference(): boolean {
  try {
    const stored = localStorage.getItem(CELLULAR_AUTO_DOWNLOAD_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
  } catch {
    // localStorage unavailable
  }
  return true;
}

function persistCellularPreference(enabled: boolean): void {
  try {
    localStorage.setItem(CELLULAR_AUTO_DOWNLOAD_KEY, String(enabled));
  } catch {
    // localStorage unavailable
  }
}

@Injectable({ providedIn: 'root' })
export class DataStorageService {
  readonly cellularAutoDownload = signal<boolean>(loadCellularPreference());

  clearLocalCache(): void {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }
    // Re-persist the cellular preference since localStorage was cleared
    persistCellularPreference(this.cellularAutoDownload());
  }

  async estimateCacheSize(): Promise<number> {
    let total = 0;
    // Estimate from Cache API
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          // ⚡ Bolt Optimization: Use cache.matchAll() to fetch all responses concurrently
          // and check Content-Length header before falling back to blob() to avoid memory allocation overhead
          const responses = await cache.matchAll();
          for (const response of responses) {
            const contentLength = response.headers.get('Content-Length');
            if (contentLength) {
              total += parseInt(contentLength, 10);
            } else {
              const blob = await response.clone().blob();
              total += blob.size;
            }
          }
        }
      } catch {
        // Cache API estimation unavailable
      }
    }
    // Estimate from localStorage and sessionStorage
    try {
      total += new Blob([JSON.stringify(localStorage)]).size;
      total += new Blob([JSON.stringify(sessionStorage)]).size;
    } catch {
      // Storage estimation unavailable
    }
    return total;
  }

  toggleCellularAutoDownload(): void {
    this.cellularAutoDownload.update((val) => {
      const next = !val;
      persistCellularPreference(next);
      return next;
    });
  }
}
