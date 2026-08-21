import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ServiceHealth {
  service: string;
  healthy: boolean;
  degraded: boolean;
  lastChecked: number;
  errorMessage?: string;
}

export interface DegradationState {
  livekit: ServiceHealth;
  supabase: ServiceHealth;
  centrifugo: ServiceHealth;
  overallHealthy: boolean;
  allServicesUp: boolean;
}

/**
 * Reactive degradation tracking for the Live Audio Rooms architecture.
 *
 * Monitors LiveKit, Supabase, and Centrifugo health and exposes signal-based
 * state so UI components can reactively show degraded-mode indicators.
 */
@Injectable({
  providedIn: 'root',
})
export class AudioRoomDegradationService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/audio-rooms`;

  readonly degradationState = signal<DegradationState>({
    livekit: { service: 'livekit', healthy: true, degraded: false, lastChecked: 0 },
    supabase: { service: 'supabase', healthy: true, degraded: false, lastChecked: 0 },
    centrifugo: { service: 'centrifugo', healthy: true, degraded: false, lastChecked: 0 },
    overallHealthy: true,
    allServicesUp: true,
  });

  readonly isLiveKitDegraded = computed(() => {
    const state = this.degradationState();
    return !state.livekit.healthy || state.livekit.degraded;
  });

  readonly isSupabaseDegraded = computed(() => {
    const state = this.degradationState();
    return !state.supabase.healthy || state.supabase.degraded;
  });

  readonly isCentrifugoDegraded = computed(() => {
    const state = this.degradationState();
    return !state.centrifugo.healthy || state.centrifugo.degraded;
  });

  readonly isAnyServiceDegraded = computed(() => {
    const state = this.degradationState();
    return (
      !state.livekit.healthy ||
      state.livekit.degraded ||
      !state.supabase.healthy ||
      state.supabase.degraded ||
      !state.centrifugo.healthy ||
      state.centrifugo.degraded
    );
  });

  readonly isFullyOperational = computed(() => {
    return this.degradationState().allServicesUp;
  });

  readonly degradationSummary = computed(() => {
    const state = this.degradationState();
    const degraded: string[] = [];
    if (!state.livekit.healthy || state.livekit.degraded) {
      degraded.push(`LiveKit${state.livekit.errorMessage ? `: ${state.livekit.errorMessage}` : ''}`);
    }
    if (!state.supabase.healthy || state.supabase.degraded) {
      degraded.push(`Supabase${state.supabase.errorMessage ? `: ${state.supabase.errorMessage}` : ''}`);
    }
    if (!state.centrifugo.healthy || state.centrifugo.degraded) {
      degraded.push(`Centrifugo${state.centrifugo.errorMessage ? `: ${state.centrifugo.errorMessage}` : ''}`);
    }
    return degraded;
  });

  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly POLLING_INTERVAL_MS = 20_000;

  /**
   * Start polling the backend health endpoint.
   * Call this when the user enters an audio room context.
   */
  startMonitoring(): void {
    this.stopMonitoring();
    this.fetchHealth().catch(() => {
      // Initial fetch failure is non-fatal; polling will retry
    });
    // Exception allowed: interval polling for external service health
    // is a non-reactive side effect integrating with a non-Angular API.
    this.pollingTimer = setInterval(() => {
      this.fetchHealth().catch(() => {
        // Polling failures are logged but not surfaced as errors
      });
    }, this.POLLING_INTERVAL_MS);
  }

  /**
   * Stop polling the backend health endpoint.
   * Call this when the user leaves the audio room context.
   */
  stopMonitoring(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Manually trigger a health refresh. Returns the latest degradation state.
   */
  async refreshHealth(): Promise<DegradationState> {
    await this.fetchHealth();
    return this.degradationState();
  }

  private async fetchHealth(): Promise<void> {
    try {
      const state = await firstValueFrom(
        this.http.get<DegradationState>(`${this.baseUrl}/health`),
      );
      this.degradationState.set(state);
    } catch {
      // If the health endpoint itself is unreachable, mark all as unknown
      this.degradationState.update((current) => ({
        livekit: { ...current.livekit, healthy: false, degraded: true, lastChecked: Date.now(), errorMessage: 'Endpoint unreachable' },
        supabase: { ...current.supabase, healthy: false, degraded: true, lastChecked: Date.now(), errorMessage: 'Endpoint unreachable' },
        centrifugo: { ...current.centrifugo, healthy: false, degraded: true, lastChecked: Date.now(), errorMessage: 'Endpoint unreachable' },
        overallHealthy: false,
        allServicesUp: false,
      }));
    }
  }
}