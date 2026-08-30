import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type ChatTextSize = 'small' | 'medium' | 'large';

export interface ChatSettings {
  autoTranslate: boolean;
  readReceipts: boolean;
  enterToSend: boolean;
  textSize: ChatTextSize;
}

function isChatTextSize(value: unknown): value is ChatTextSize {
  return value === 'small' || value === 'medium' || value === 'large';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function booleanSetting(
  source: Record<string, unknown>,
  key: 'autoTranslate' | 'readReceipts' | 'enterToSend',
): boolean {
  return source[key] === true;
}

@Injectable({ providedIn: 'root' })
export class ChatSettingsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat/settings`;

  readonly autoTranslate = signal<boolean>(false);
  readonly readReceipts = signal<boolean>(false);
  readonly enterToSend = signal<boolean>(false);
  readonly textSize = signal<ChatTextSize>('medium');
  readonly loaded = signal<boolean>(false);
  readonly loadFailed = signal<boolean>(false);
  readonly saving = signal<boolean>(false);

  async loadSettings(): Promise<boolean> {
    this.loaded.set(false);
    this.loadFailed.set(false);

    try {
      const headers = this.auth.getBearerHeaders();
      const result = await firstValueFrom(this.http.get<unknown>(this.baseUrl, { headers }));
      if (!isRecord(result)) {
        throw new Error('Invalid chat settings response');
      }

      this.autoTranslate.set(booleanSetting(result, 'autoTranslate'));
      this.readReceipts.set(booleanSetting(result, 'readReceipts'));
      this.enterToSend.set(booleanSetting(result, 'enterToSend'));
      this.textSize.set(isChatTextSize(result['textSize']) ? result['textSize'] : 'medium');
      this.loaded.set(true);
      return true;
    } catch {
      // Do not present safe defaults as if they were authoritative account state.
      // The settings page exposes an explicit retry state instead.
      this.loadFailed.set(true);
      this.loaded.set(true);
      return false;
    }
  }

  async updateSetting(
    key: keyof ChatSettings,
    value: boolean | ChatTextSize,
  ): Promise<boolean> {
    if (!this.isValidSettingValue(key, value) || this.saving()) return false;

    this.saving.set(true);
    try {
      const headers = this.auth.getBearerHeaders();
      await firstValueFrom(this.http.put(this.baseUrl, { [key]: value }, { headers }));
      // Apply only after the server confirms persistence. This avoids stale optimistic
      // rollback when users activate multiple controls in quick succession.
      this.setLocal(key, value);
      return true;
    } catch {
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  async resetToDefaults(): Promise<boolean> {
    if (this.saving()) return false;

    this.saving.set(true);
    try {
      const headers = this.auth.getBearerHeaders();
      await firstValueFrom(
        this.http.put(
          this.baseUrl,
          { autoTranslate: false, readReceipts: false, enterToSend: false },
          { headers },
        ),
      );
      this.autoTranslate.set(false);
      this.readReceipts.set(false);
      this.enterToSend.set(false);
      return true;
    } catch {
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private isValidSettingValue(
    key: keyof ChatSettings,
    value: boolean | ChatTextSize,
  ): boolean {
    if (key === 'textSize') return isChatTextSize(value);
    return typeof value === 'boolean';
  }

  private setLocal(key: keyof ChatSettings, value: boolean | ChatTextSize): void {
    switch (key) {
      case 'autoTranslate':
        if (typeof value === 'boolean') this.autoTranslate.set(value);
        break;
      case 'readReceipts':
        if (typeof value === 'boolean') this.readReceipts.set(value);
        break;
      case 'enterToSend':
        if (typeof value === 'boolean') this.enterToSend.set(value);
        break;
      case 'textSize':
        if (isChatTextSize(value)) this.textSize.set(value);
        break;
    }
  }
}
