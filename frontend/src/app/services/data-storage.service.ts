import { Injectable, signal } from '@angular/core';

const CELLULAR_AUTO_DOWNLOAD_KEY = 'hellotalk_cellular_auto_download';
const LOCAL_CACHE_PREFIXES = ['elgl:tr:'] as const;

function loadCellularPreference(): boolean {
  try {
    const stored = localStorage.getItem(CELLULAR_AUTO_DOWNLOAD_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
  } catch {
    // Browser storage is optional (SSR/private mode/storage denial).
  }
  return true;
}

function persistCellularPreference(enabled: boolean): void {
  try {
    localStorage.setItem(CELLULAR_AUTO_DOWNLOAD_KEY, String(enabled));
  } catch {
    // A preference write must never make the settings screen unusable.
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

function estimateLocalCacheSize(): number {
  try {
    let total = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !LOCAL_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
      const value = localStorage.getItem(key) ?? '';
      total += new Blob([key, value]).size;
    }
    return total;
  } catch {
    return 0;
  }
}

@Injectable({ providedIn: 'root' })
export class DataStorageService {
  readonly cellularAutoDownload = signal<boolean>(loadCellularPreference());

  async estimateCacheSize(): Promise<number> {
    let total = estimateLocalCacheSize();

    if (typeof caches !== 'undefined') {
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
        total += cacheSizes.reduce((sum, size) => sum + size, 0);
      } catch {
        // Cache API estimation is best effort. Keep any local cache estimate.
      }
    }

    return total;
  }

  setCellularAutoDownload(enabled: boolean): void {
    if (this.cellularAutoDownload() === enabled) return;
    persistCellularPreference(enabled);
    this.cellularAutoDownload.set(enabled);
  }

  toggleCellularAutoDownload(): void {
    this.setCellularAutoDownload(!this.cellularAutoDownload());
  }
}
