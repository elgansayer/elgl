import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DataStorageService {
  readonly cellularAutoDownload = signal<boolean>(true);

  clearLocalCache(): void {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      });
    }
  }

  toggleCellularAutoDownload(): void {
    this.cellularAutoDownload.update(val => !val);
  }
}
