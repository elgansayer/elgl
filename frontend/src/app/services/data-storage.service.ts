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

async function responseSize(response: Response): Promise<number> {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null && contentLength.trim() !== '') {
    const parsedLength = Number(contentLength);
    if (Number.isSafeInteger(parsedLength) && parsedLength >= 0) {
      return parsedLength;
    }
  }
  return (await response.clone().blob()).size;
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
        const cacheSizes = await Promise.all(
          cacheNames.map(async (cacheName) => {
            const cache = await caches.open(cacheName);
            const responses = await cache.matchAll();
            const responseSizes = await Promise.all(responses.map(responseSize));
            return responseSizes.reduce((sum, size) => sum + size, 0);
          }),
        );
        total += cacheSizes.reduce((a, b) => a + b, 0);
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
