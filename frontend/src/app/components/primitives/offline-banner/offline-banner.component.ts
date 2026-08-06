import { Component, inject, computed } from '@angular/core';
import { NetworkStatusService } from '../../../services/network-status.service';
import { TranslatePipe } from '../../../services/translate.pipe';

@Component({
  selector: 'app-offline-banner',
  imports: [TranslatePipe],
  template: `
    @if (!networkStatus.isOnline()) {
      <div
        class="fixed top-0 inset-x-0 z-[9998] flex items-center justify-center gap-2 py-2 px-4 bg-amber-500/90 text-black text-sm font-semibold backdrop-blur-sm transition-all duration-300"
        role="alert"
        aria-live="assertive"
      >
        <span class="text-base leading-none" aria-hidden="true">📡</span>
        <span>{{ 'offlineBanner.message' | t }}</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class OfflineBannerComponent {
  readonly networkStatus = inject(NetworkStatusService);
}