import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, effect, computed } from '@angular/core';
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
  }

  async clearCache(): Promise<void> {
    this.isClearingCache.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    try {
      this.dataStorageService.clearLocalCache();
      await this.cacheService.clearCache();
      this.successMessage.set('dataStorage.cacheCleared');
      await this.computeCacheSize();
    } catch {
      this.errorMessage.set('Failed to clear cache');
    } finally {
      this.isClearingCache.set(false);
    }
  }

  async deleteOldMedia(): Promise<void> {
    this.isDeletingOldMedia.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    try {
      await this.cacheService.deleteOldMedia();
      this.successMessage.set('dataStorage.oldMediaDeleted');
      await this.computeCacheSize();
    } catch {
      this.errorMessage.set('Failed to delete old media');
    } finally {
      this.isDeletingOldMedia.set(false);
    }
  }

  toggleCellular(): void {
    this.dataStorageService.toggleCellularAutoDownload();
  }

  goBack(): void {
    this.location.back();
  }
}
