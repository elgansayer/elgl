import { Component, inject, signal } from '@angular/core';
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
  protected dataStorageService = inject(DataStorageService);
  private cacheService = inject(CacheService);

  readonly isClearingCache = signal(false);
  readonly isDeletingOldMedia = signal(false);

  async clearCache(): Promise<void> {
    this.isClearingCache.set(true);
    try {
      await this.cacheService.clearCache();
    } finally {
      this.isClearingCache.set(false);
    }
  }

  async deleteOldMedia(): Promise<void> {
    this.isDeletingOldMedia.set(true);
    try {
      await this.cacheService.deleteOldMedia();
    } finally {
      this.isDeletingOldMedia.set(false);
    }
  }

  toggleCellular(): void {
    this.dataStorageService.toggleCellularAutoDownload();
  }
}
