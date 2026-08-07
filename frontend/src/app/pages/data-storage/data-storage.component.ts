<<<<<<< HEAD
import { Component, inject, signal, computed } from '@angular/core';
=======
import { Component, inject, signal, effect, computed } from '@angular/core';
>>>>>>> origin/main
import { Location } from '@angular/common';
import { DataStorageService } from '../../services/data-storage.service';
import { CacheService } from '../../services/cache.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-data-storage',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './data-storage.component.html',
})
export class DataStorageComponent {
  private dataStorageService = inject(DataStorageService);
  private cacheService = inject(CacheService);
  private location = inject(Location);

  readonly isClearingCache = signal(false);
  readonly isDeletingOldMedia = signal(false);
<<<<<<< HEAD
  readonly isDownloading = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly storageEstimateBytes = signal<number | null>(null);
  readonly storageQuotaBytes = signal<number | null>(null);

  readonly storageUsedLabel = computed(() => {
    const used = this.storageEstimateBytes();
    if (used === null) return '';
    return this.formatBytes(used);
  });

  readonly totalStorageLabel = computed(() => {
    const quota = this.storageQuotaBytes();
    if (quota === null) return '';
    return this.formatBytes(quota);
  });

  readonly storageUsedPercent = computed(() => {
    const used = this.storageEstimateBytes();
    const quota = this.storageQuotaBytes();
    if (used === null || quota === null || quota === 0) {
      return 0;
    }
    return Math.min(Math.round((used / quota) * 100), 100);
  });

  constructor() {
    this.estimateStorage();
  }

  goBack(): void {
    this.location.back();
=======
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly cacheSize = signal<number | null>(null);
  readonly isComputingSize = signal(false);

  readonly cellularAutoDownload = this.dataStorageService.cellularAutoDownload;

  readonly formattedCacheSize = computed(() => {
    const bytes = this.cacheSize();
    if (bytes === null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  constructor() {
    effect(() => {
      // Trigger size computation on init
      void this.computeCacheSize();
    });
  }

  async computeCacheSize(): Promise<void> {
    this.isComputingSize.set(true);
    try {
      const size = await this.dataStorageService.estimateCacheSize();
      this.cacheSize.set(size);
    } catch {
      this.cacheSize.set(0);
    } finally {
      this.isComputingSize.set(false);
    }
>>>>>>> origin/main
  }

  async clearCache(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isClearingCache.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    try {
      this.dataStorageService.clearLocalCache();
      await this.cacheService.clearCache();
<<<<<<< HEAD
      this.successMessage.set('dataStorage.cacheClearedSuccess');
      await this.estimateStorage();
    } catch {
      this.errorMessage.set('common.error_occurred');
=======
      this.successMessage.set('dataStorage.cacheCleared');
      await this.computeCacheSize();
    } catch {
      this.errorMessage.set('Failed to clear cache');
>>>>>>> origin/main
    } finally {
      this.isClearingCache.set(false);
    }
  }

  async deleteOldMedia(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isDeletingOldMedia.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    try {
      await this.cacheService.deleteOldMedia();
<<<<<<< HEAD
      this.successMessage.set('dataStorage.oldMediaDeletedSuccess');
      await this.estimateStorage();
    } catch {
      this.errorMessage.set('common.error_occurred');
=======
      this.successMessage.set('dataStorage.oldMediaDeleted');
      await this.computeCacheSize();
    } catch {
      this.errorMessage.set('Failed to delete old media');
>>>>>>> origin/main
    } finally {
      this.isDeletingOldMedia.set(false);
    }
  }

  toggleCellular(): void {
    this.dataStorageService.toggleCellularAutoDownload();
  }

<<<<<<< HEAD
  async downloadMyData(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isDownloading.set(true);
    try {
      this.successMessage.set('dataStorage.downloadStarted');
    } catch {
      this.errorMessage.set('common.error_occurred');
    } finally {
      this.isDownloading.set(false);
    }
  }

  private async estimateStorage(): Promise<void> {
    if ('storage' in navigator && typeof navigator.storage?.estimate === 'function') {
      try {
        const estimate = await navigator.storage.estimate();
        this.storageEstimateBytes.set(estimate.usage ?? 0);
        this.storageQuotaBytes.set(estimate.quota ?? 0);
      } catch {
        this.storageEstimateBytes.set(null);
        this.storageQuotaBytes.set(null);
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return value.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
=======
  goBack(): void {
    this.location.back();
>>>>>>> origin/main
  }
}
