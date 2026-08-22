import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { DataStorageService } from '../../services/data-storage.service';
import { CacheService } from '../../services/cache.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-data-storage',
  imports: [HlmCheckbox, HlmButton, TranslatePipe],
  templateUrl: './data-storage.component.html',
})
export class DataStorageComponent {
  private dataStorageService = inject(DataStorageService);
  private cacheService = inject(CacheService);
  private location = inject(Location);

  readonly isClearingCache = signal(false);
  readonly isDeletingOldMedia = signal(false);
  readonly confirmClearCache = signal(false);
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
    void this.computeCacheSize();
  }

  async computeCacheSize(): Promise<void> {
    this.isComputingSize.set(true);
    try {
      const size = await this.dataStorageService.estimateCacheSize();
      this.cacheSize.set(size);
    } catch {
      this.cacheSize.set(null);
    } finally {
      this.isComputingSize.set(false);
    }
  }

  requestClearCache(): void {
    if (this.isClearingCache()) return;
    this.successMessage.set('');
    this.errorMessage.set('');
    this.confirmClearCache.set(true);
  }

  cancelClearCache(): void {
    if (this.isClearingCache()) return;
    this.confirmClearCache.set(false);
  }

  async clearCache(): Promise<void> {
    if (!this.confirmClearCache() || this.isClearingCache()) return;

    this.isClearingCache.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    try {
      await this.cacheService.clearCache();
      this.confirmClearCache.set(false);
      this.successMessage.set('dataStorage.cacheCleared');
    } catch {
      this.errorMessage.set('Failed to clear all cached data. Please try again.');
    } finally {
      this.isClearingCache.set(false);
      await this.computeCacheSize();
    }
  }

  async deleteOldMedia(): Promise<void> {
    if (this.isDeletingOldMedia()) return;

    this.isDeletingOldMedia.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    try {
      await this.cacheService.deleteOldMedia();
      this.successMessage.set('dataStorage.oldMediaDeleted');
    } catch {
      this.errorMessage.set('Failed to delete old media. Please try again.');
    } finally {
      this.isDeletingOldMedia.set(false);
      await this.computeCacheSize();
    }
  }

  toggleCellular(): void {
    this.dataStorageService.toggleCellularAutoDownload();
  }

  goBack(): void {
    this.location.back();
  }
}
