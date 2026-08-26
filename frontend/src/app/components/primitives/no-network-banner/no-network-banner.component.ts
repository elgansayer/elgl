import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';
import { NetworkStatusService } from '../../../services/network-status.service';

@Component({
  selector: 'app-no-network-banner',
  imports: [TranslatePipe],
  template: `
    @if (!isOnline()) {
      <div
        class="fixed top-0 inset-x-0 z-[10000] flex items-center justify-center gap-2 bg-danger text-on-fill px-4 py-2 text-sm font-semibold shadow-lift transition-transform duration-base ease-app"
        role="alert"
        aria-live="assertive"
      >
        <span class="text-lg leading-none" aria-hidden="true">📡</span>
        <span>{{ 'no_network_banner.message' | t }}</span>
      </div>
    }
  `,
  host: {
    '[class]': "'block'",
  },
})
export class NoNetworkBannerComponent {
  private networkStatus = inject(NetworkStatusService);
  readonly isOnline = this.networkStatus.isOnline;
}
