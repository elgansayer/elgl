import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfig, MockBackendMode } from './app-config.interface';

const MOCK_BACKEND_MODES = new Set<MockBackendMode>([
  'disabled',
  'local',
  'test',
  'demo',
]);
const MOCK_CLIENT_ENVIRONMENTS = new Set([
  'development',
  'local',
  'test',
  'storybook',
  'demo',
]);

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  private http = inject(HttpClient);
  private _config: AppConfig | null = null;
  private readonly configUrl = './assets/config.json';

  private readonly fallbackConfig: AppConfig = {
    apiEndpoint: 'http://localhost:3000/api',
    appName: 'FallbackApp',
    version: '0.0.0',
    environment: 'fallback',
    mockBackendMode: 'disabled',
    features: {},
  };

  public get config(): AppConfig {
    if (!this._config) {
      console.warn('Configuration accessed before initialization, using fallback');
      return this.fallbackConfig;
    }
    return this._config;
  }

  public get mockBackendMode(): MockBackendMode {
    return this.config.mockBackendMode ?? 'disabled';
  }

  public get isMockBackend(): boolean {
    return this.mockBackendMode !== 'disabled';
  }

  public async loadConfiguration(): Promise<void> {
    try {
      const config = await firstValueFrom(this.http.get<AppConfig>(this.configUrl));
      this._config = this.validateMockBackendBoundary(config);
    } catch {
      // Runtime configuration failures must fail closed. In particular, never
      // turn a production config/provider failure into an implicit demo mode.
      console.error('Failed to load configuration. Using safe fallback.');
      this._config = this.fallbackConfig;
    }
  }

  private validateMockBackendBoundary(config: AppConfig): AppConfig {
    const mode = config.mockBackendMode ?? 'disabled';
    if (!MOCK_BACKEND_MODES.has(mode)) {
      throw new Error('Invalid mock backend mode');
    }

    const environment = config.environment.trim().toLowerCase();
    if (mode !== 'disabled' && !MOCK_CLIENT_ENVIRONMENTS.has(environment)) {
      throw new Error('Mock backend mode is not allowed in this client environment');
    }

    return {
      ...config,
      mockBackendMode: mode,
    };
  }
}
