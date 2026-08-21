import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from './app-config.interface';

@Injectable({
  providedIn: 'root'
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
    features: {}
  };

  public get config(): AppConfig {
    if (!this._config) {
      console.warn('Configuration accessed before initialization, using fallback');
      return this.fallbackConfig;
    }
    return this._config;
  }

  public async loadConfiguration(): Promise<void> {
    try {
      const config = await firstValueFrom(this.http.get<AppConfig>(this.configUrl));
      this._config = config;
    } catch (error) {
      console.error('Failed to load configuration. Using fallback.', error);
      this._config = this.fallbackConfig;
    }
  }
}
