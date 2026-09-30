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

@Injectable({ providedIn: 'root' })
export class ChatSettingsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/chat/settings`;

  readonly autoTranslate = signal<boolean>(false);
  readonly readReceipts = signal<boolean>(false);
  readonly enterToSend = signal<boolean>(false);
  readonly textSize = signal<ChatTextSize>('medium');
  readonly loaded = signal<boolean>(false);

  async loadSettings(): Promise<boolean> {
    try {
      const headers = this.auth.getBearerHeaders();
      const result = await firstValueFrom(this.http.get<ChatSettings>(this.baseUrl, { headers }));
      this.autoTranslate.set(result.autoTranslate === true);
      this.readReceipts.set(result.readReceipts === true);
      this.enterToSend.set(result.enterToSend === true);
      this.textSize.set(isChatTextSize(result.textSize) ? result.textSize : 'medium');
      this.loaded.set(true);
      return true;
    } catch {
      // Preserve the safe in-memory defaults. Callers that have a local cache can keep it active.
      this.loaded.set(true);
      return false;
    }
  }

  async updateSetting(
    key: keyof ChatSettings,
    value: boolean | ChatTextSize,
  ): Promise<boolean> {
    if (key === 'textSize' && !isChatTextSize(value)) return false;

    const previous = this.getLocal(key);
    this.setLocal(key, value);
    try {
      const headers = this.auth.getBearerHeaders();
      await firstValueFrom(this.http.put(this.baseUrl, { [key]: value }, { headers }));
      return true;
    } catch {
      // Revert optimistic state and let the caller surface a retryable failure when needed.
      this.setLocal(key, previous);
      return false;
    }
  }

  resetToDefaults(): void {
    this.autoTranslate.set(false);
    this.readReceipts.set(false);
    this.enterToSend.set(false);
    this.textSize.set('medium');
  }

  private getLocal(key: keyof ChatSettings): boolean | ChatTextSize {
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

  private setLocal(key: keyof ChatSettings, value: boolean | ChatTextSize): void {
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
        if (isChatTextSize(value)) {
          this.textSize.set(value);
        }
        break;
    }
  }
}
