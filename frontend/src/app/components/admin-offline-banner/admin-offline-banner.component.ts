import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';

@Component({
  selector: 'app-admin-offline-banner',
  imports: [TranslatePipe],
  template: `
    @if (!isOnline()) {
      <div
        class="flex items-center justify-center gap-2 bg-warning text-on-fill px-4 py-2 text-sm font-semibold shadow-md"
        role="alert"
        aria-live="assertive"
      >
        <span class="text-base leading-none" aria-hidden="true">⚠️</span>
        <span>{{ 'admin.offline.banner' | t }}</span>
        @if (cachedDataAvailable()) {
          <span class="text-on-fill/80">
            {{ 'admin.offline.cachedDataAvailable' | t }}
          </span>
        }
      </div>
    }
  `,
})
export class AdminOfflineBannerComponent {
  private offlineStorage = inject(OfflineAdminStorageService);

  readonly isOnline = this.offlineStorage.isOnline;
  readonly cachedDataAvailable = this.offlineStorage.cachedDataAvailable;
}
