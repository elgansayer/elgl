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

  /** Estimate cache storage only; authentication, drafts and preferences are user data, not cache. */
  async estimateCacheSize(): Promise<number> {
    if (typeof caches === 'undefined') {
      return 0;
    }

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
      return cacheSizes.reduce((total, size) => total + size, 0);
    } catch {
      // Cache API estimation unavailable
      return 0;
    }
  }

  toggleCellularAutoDownload(): void {
    this.cellularAutoDownload.update((val) => {
      const next = !val;
      persistCellularPreference(next);
      return next;
    });
  }
}
