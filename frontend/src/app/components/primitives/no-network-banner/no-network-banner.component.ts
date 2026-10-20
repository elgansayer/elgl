import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';
import { NetworkStatusService } from '../../../services/network-status.service';
import { ConfigurationService } from '../../../core/config/configuration.service';

@Component({
  selector: 'app-no-network-banner',
  imports: [TranslatePipe],
  template: `
    <div class="fixed top-0 inset-x-0 z-[10000] flex flex-col items-stretch">
      @if (!isOnline()) {
        <div
          class="flex items-center justify-center gap-2 bg-danger text-on-fill px-4 py-2 text-sm font-semibold shadow-lift transition-transform duration-base ease-app"
          role="alert"
          aria-live="assertive"
        >
          <span class="text-lg leading-none" aria-hidden="true">📡</span>
          <span>{{ 'no_network_banner.message' | t }}</span>
        </div>
      }
      @if (configuration.isMockBackend) {
        <div
          data-testid="mock-backend-indicator"
          class="flex items-center justify-center gap-2 bg-warning text-text-primary px-4 py-2 text-sm font-semibold shadow-lift"
          role="status"
          aria-live="polite"
        >
          <span class="text-lg leading-none" aria-hidden="true">🧪</span>
          <span dir="auto">{{ configuration.config.appName }}</span>
          <span aria-hidden="true">·</span>
          <strong>{{ configuration.mockBackendMode }}</strong>
        </div>
      }
    </div>
  `,
  host: {
    '[class]': "'block'",
  },
})
export class NoNetworkBannerComponent {
  private networkStatus = inject(NetworkStatusService);
  readonly configuration = inject(ConfigurationService);
  readonly isOnline = this.networkStatus.isOnline;
}
