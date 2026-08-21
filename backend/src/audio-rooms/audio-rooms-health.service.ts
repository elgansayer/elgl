import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

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

interface LiveKitHealthResponse {
  status: string;
  checks: Array<{ name: string; passing: boolean }>;
}

@Injectable()
export class AudioRoomsHealthService implements OnModuleInit {
  private readonly logger = new Logger(AudioRoomsHealthService.name);
  private readonly livekitUrl: string;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private readonly HEALTH_CHECK_INTERVAL_MS = 15_000;

  private livekitHealth: ServiceHealth = {
    service: 'livekit',
    healthy: false,
    degraded: false,
    lastChecked: 0,
  };

  private supabaseHealth: ServiceHealth = {
    service: 'supabase',
    healthy: false,
    degraded: false,
    lastChecked: 0,
  };

  private centrifugoHealth: ServiceHealth = {
    service: 'centrifugo',
    healthy: false,
    degraded: false,
    lastChecked: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.livekitUrl =
      this.configService.get<string>('LIVEKIT_URL') ||
      'https://mock.livekit.cloud';
  }

  onModuleInit(): void {
    this.runAllHealthChecks().catch((err) =>
      this.logger.warn('Initial health check failed', err),
    );

    // Exception allowed by architecture: interval-based health polling
    // is a third-party service monitoring concern, not reactive state.
    this.healthCheckTimer = setInterval(() => {
      this.runAllHealthChecks().catch((err) =>
        this.logger.error('Periodic health check failed', err),
      );
    }, this.HEALTH_CHECK_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  getDegradationState(): DegradationState {
    const services = [
      this.livekitHealth,
      this.supabaseHealth,
      this.centrifugoHealth,
    ];
    const allServicesUp = services.every((s) => s.healthy);
    const overallHealthy = services.some((s) => s.healthy);

    return {
      livekit: { ...this.livekitHealth },
      supabase: { ...this.supabaseHealth },
      centrifugo: { ...this.centrifugoHealth },
      overallHealthy,
      allServicesUp,
    };
  }

  isServiceAvailable(service: 'livekit' | 'supabase' | 'centrifugo'): boolean {
    switch (service) {
      case 'livekit':
        return this.livekitHealth.healthy;
      case 'supabase':
        return this.supabaseHealth.healthy;
      case 'centrifugo':
        return this.centrifugoHealth.healthy;
      default:
        return false;
    }
  }

  private async runAllHealthChecks(): Promise<void> {
    await Promise.allSettled([
      this.checkLiveKitHealth(),
      this.checkSupabaseHealth(),
      this.checkCentrifugoHealth(),
    ]);
  }

  private async checkLiveKitHealth(): Promise<void> {
    try {
      if (this.livekitUrl.includes('mock')) {
        this.livekitHealth = {
          service: 'livekit',
          healthy: true,
          degraded: true,
          lastChecked: Date.now(),
          errorMessage: 'Running in mock mode',
        };
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.livekitUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const body = (await response.json()) as LiveKitHealthResponse;
        this.livekitHealth = {
          service: 'livekit',
          healthy: body.status === 'OK' || body.status === 'healthy',
          degraded: false,
          lastChecked: Date.now(),
        };
      } else {
        this.livekitHealth = {
          service: 'livekit',
          healthy: false,
          degraded: true,
          lastChecked: Date.now(),
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.livekitHealth = {
        service: 'livekit',
        healthy: false,
        degraded: true,
        lastChecked: Date.now(),
        errorMessage: message,
      };
    }
  }

  private async checkSupabaseHealth(): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase
        .from('audio_rooms')
        .select('id', { count: 'exact', head: true });

      this.supabaseHealth = {
        service: 'supabase',
        healthy: !error,
        degraded: false,
        lastChecked: Date.now(),
        errorMessage: error ? error.message : undefined,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.supabaseHealth = {
        service: 'supabase',
        healthy: false,
        degraded: true,
        lastChecked: Date.now(),
        errorMessage: message,
      };
    }
  }

  private async checkCentrifugoHealth(): Promise<void> {
    try {
      const centrifugoUrl =
        this.configService.get<string>('CENTRIFUGO_API_URL') ||
        'http://localhost:8000';

      const apiKey = this.configService.get<string>('CENTRIFUGO_API_KEY') || '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${centrifugoUrl}/api/health`, {
        signal: controller.signal,
        headers: apiKey ? { Authorization: `apikey ${apiKey}` } : {},
      });
      clearTimeout(timeout);

      this.centrifugoHealth = {
        service: 'centrifugo',
        healthy: response.ok,
        degraded: false,
        lastChecked: Date.now(),
        errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.centrifugoHealth = {
        service: 'centrifugo',
        healthy: false,
        degraded: true,
        lastChecked: Date.now(),
        errorMessage: message,
      };
    }
  }
}
