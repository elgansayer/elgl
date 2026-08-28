import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ChatSettings {
  autoTranslate: boolean;
  readReceipts: boolean;
  enterToSend: boolean;
  textSize: 'small' | 'medium' | 'large';
}

@Injectable({ providedIn: 'root' })
export class ChatSettingsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/chat/settings`;

  readonly autoTranslate = signal<boolean>(false);
  readonly readReceipts = signal<boolean>(false);
  readonly enterToSend = signal<boolean>(false);
  readonly textSize = signal<'small' | 'medium' | 'large'>('medium');
  readonly loaded = signal<boolean>(false);

  async loadSettings(): Promise<void> {
    try {
      const headers = this.auth.getBearerHeaders();
      const result = await firstValueFrom(this.http.get<ChatSettings>(this.baseUrl, { headers }));
      this.autoTranslate.set(result.autoTranslate);
      this.readReceipts.set(result.readReceipts);
      this.enterToSend.set(result.enterToSend);
      this.textSize.set(result.textSize ?? 'medium');
      this.loaded.set(true);
    } catch {
      // fallback to defaults
      this.autoTranslate.set(false);
      this.readReceipts.set(false);
      this.enterToSend.set(false);
      this.textSize.set('medium');
      this.loaded.set(true);
    }
  }

  async updateSetting(
    key: keyof ChatSettings,
    value: boolean | 'small' | 'medium' | 'large',
  ): Promise<void> {
    const previous = this.getLocal(key);
    this.setLocal(key, value);
    try {
      const headers = this.auth.getBearerHeaders();
      await firstValueFrom(this.http.put(this.baseUrl, { [key]: value }, { headers }));
    } catch {
      // revert on failure
      this.setLocal(key, previous);
    }
  }

  resetToDefaults(): void {
    this.autoTranslate.set(false);
    this.readReceipts.set(false);
    this.enterToSend.set(false);
    this.textSize.set('medium');
  }

  private getLocal(
    key: keyof ChatSettings,
  ): boolean | 'small' | 'medium' | 'large' {
    switch (key) {
      case 'autoTranslate':
        return this.autoTranslate();
      case 'readReceipts':
        return this.readReceipts();
      case 'enterToSend':
        return this.enterToSend();
      case 'textSize':
        return this.textSize();
    }
  }

  private setLocal(
    key: keyof ChatSettings,
    value: boolean | 'small' | 'medium' | 'large',
  ): void {
    switch (key) {
      case 'autoTranslate':
        this.autoTranslate.set(Boolean(value));
        break;
      case 'readReceipts':
        this.readReceipts.set(Boolean(value));
        break;
      case 'enterToSend':
        this.enterToSend.set(Boolean(value));
        break;
      case 'textSize':
        if (value === 'small' || value === 'medium' || value === 'large') {
          this.textSize.set(value);
        }
        break;
    }
  }
}
