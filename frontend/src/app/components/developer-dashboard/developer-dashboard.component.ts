import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, resource } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EconomyStore } from '../../services/economy.store';
import { AuthService } from '../../services/auth.service';
import { DiscoveryService, SearchFilterParams } from '../../services/discovery.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { UserProfile } from '../../services/user.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppChipComponent } from '../primitives/chip/chip.component';
import { AppInputComponent } from '../primitives/input/input.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-developer-dashboard',
  imports: [
    HlmCheckbox,
    HlmButton,
    FormsModule,
    TranslatePipe,
    UpperCasePipe,
    AppCardComponent,
    AppChipComponent,
    AppInputComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
  ],
  templateUrl: './developer-dashboard.component.html',
  styleUrls: ['./developer-dashboard.component.scss'],
})
export class DeveloperDashboardComponent {
  readonly store = inject(EconomyStore);
  readonly authService = inject(AuthService);
  readonly discoveryService = inject(DiscoveryService);
  readonly centrifugeService = inject(CentrifugeService);

  readonly activeTab = signal<'overview' | 'postgis' | 'centrifugo' | 'livekit'>('overview');

  // PostGIS Matchmaking Sandbox Signals
  readonly searchLatitude = signal<number>(51.5074); // London center
  readonly searchLongitude = signal<number>(-0.1278);
  readonly searchRadiusMetres = signal<number>(5000);
  readonly spoofVipLocation = signal<boolean>(false);
  readonly discoveryResults = signal<UserProfile[]>([]);
  readonly isSearching = signal<boolean>(false);

  readonly logs = this.store.diagnosticLogs;

  // LiveKit Stage Simulator Signals
  readonly simulatedStageRole = signal<'host' | 'speaker' | 'listener'>('listener');
  readonly simulatedCanPublish = signal<boolean>(false);
  readonly isRecordingActive = signal<boolean>(false);

  // Use resource() for initial data loading instead of ngOnInit()
  private dashboardData = resource({
    loader: async () => {
      await Promise.all([this.store.loadDeveloperAnalytics(), this.store.loadDiagnosticLogs()]);
    },
  });

  setTab(tab: 'overview' | 'postgis' | 'centrifugo' | 'livekit'): void {
    this.activeTab.set(tab);
  }

  async upgrade(tier: 'consumer' | 'developer'): Promise<void> {
    // Starts a verified Stripe Checkout session and redirects the browser
    // there. VIP status only actually changes once Stripe's webhook confirms
    // payment, so no local state is updated here.
    await this.addLog(
      'REDIS',
      `Redirecting to Stripe Checkout for ${tier.toUpperCase()} tier.`,
      'info',
    );
    await this.store.upgradeVip(tier);
  }

  async generateKey(): Promise<void> {
    await this.store.generateApiKey();
    await this.addLog('REDIS', 'Generated new production API key (600 RPM).', 'success');
  }

  async runPostGisSearch(): Promise<void> {
    this.isSearching.set(true);
    try {
      const params: SearchFilterParams = {
        latitude: this.searchLatitude(),
        longitude: this.searchLongitude(),
        radius_metres: this.searchRadiusMetres(),
        serious_learner_only: false,
      };
      await this.addLog(
        'POSTGIS',
        `Executing ST_DWithin query: Lat ${params.latitude}, Lon ${params.longitude}, Radius: ${params.radius_metres}m (VIP Spoofing: ${this.spoofVipLocation() ? 'ON' : 'OFF'}).`,
        'info',
      );

      const results = await this.discoveryService.findPartners(params);
      this.discoveryResults.set(results);
      await this.addLog(
        'POSTGIS',
        `Spatial query completed in P95 latency. Found ${results.length} learners within geography boundary.`,
        'success',
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown query failure';
      await this.addLog('POSTGIS', `Query error: ${errorMessage}`, 'warn');
    } finally {
      this.isSearching.set(false);
    }
  }

  async toggleCentrifugo(): Promise<void> {
    if (this.centrifugeService.isConnected()) {
      this.centrifugeService.disconnect();
      await this.addLog(
        'CENTRIFUGO',
        'Disconnected WebSocket client from Centrifugo v5 server.',
        'warn',
      );
    } else {
      await this.centrifugeService.connect();
      await this.addLog(
        'CENTRIFUGO',
        `Connected with JWT sub: ${this.authService.currentUser()?.id || 'anon'}. Redis fan-out ready.`,
        'success',
      );
    }
  }

  async simulateRedisTimelineFanout(): Promise<void> {
    const mockPostId = `moment_${Math.floor(Math.random() * 8999 + 1000)}`;
    const mockFollowerCount = Math.floor(Math.random() * 120 + 15);
    await this.addLog(
      'REDIS',
      `Simulated RPUSH timeline_queue for post [${mockPostId}] across ${mockFollowerCount} follower streams.`,
      'success',
    );
  }

  async simulateStageHandRaise(): Promise<void> {
    this.simulatedStageRole.set('speaker');
    this.simulatedCanPublish.set(true);
    await this.addLog(
      'LIVEKIT',
      'Host approved speaker request. Re-issued JWT with canPublish: true.',
      'success',
    );
  }

  async simulateStageDemote(): Promise<void> {
    this.simulatedStageRole.set('listener');
    this.simulatedCanPublish.set(false);
    await this.addLog(
      'LIVEKIT',
      'Demoted to audience listener. Re-issued JWT with canPublish: false.',
      'warn',
    );
  }

  async toggleRecordingArchive(): Promise<void> {
    const newState = !this.isRecordingActive();
    this.isRecordingActive.set(newState);
    if (newState) {
      await this.addLog(
        'LIVEKIT',
        'Triggered composite WebRTC recording. Streaming egress to Cloudflare R2 bucket.',
        'info',
      );
    } else {
      await this.addLog(
        'LIVEKIT',
        'Stopped recording. Saved MP4 archive with pre-signed URL.',
        'success',
      );
    }
  }

  private async addLog(
    category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT',
    message: string,
    status: 'info' | 'success' | 'warn',
  ): Promise<void> {
    await this.store.createDiagnosticLog({ category, message, status });
  }
}
