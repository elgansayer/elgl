import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type DisappearingMessagesTtl = 'off' | '24h' | '7d' | '90d';

export interface ChatSettings {
  autoTranslate: boolean;
  readReceipts: boolean;
  enterToSend: boolean;
  textSize: 'small' | 'medium' | 'large';
  disappearingMessagesTtl: DisappearingMessagesTtl;
}

type ChatSettingValue = boolean | 'small' | 'medium' | 'large' | DisappearingMessagesTtl;

@Injectable({ providedIn: 'root' })
export class ChatSettingsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/chat/settings`;

  readonly autoTranslate = signal<boolean>(false);
  readonly readReceipts = signal<boolean>(false);
  readonly enterToSend = signal<boolean>(false);
  readonly textSize = signal<'small' | 'medium' | 'large'>('medium');
  readonly disappearingMessagesTtl = signal<DisappearingMessagesTtl>('off');
  readonly disappearingMessagesSaving = signal<boolean>(false);
  readonly disappearingMessagesError = signal<boolean>(false);
  readonly settingsLoadError = signal<boolean>(false);
  readonly loaded = signal<boolean>(false);

  async loadSettings(): Promise<void> {
    this.loaded.set(false);
    this.settingsLoadError.set(false);
    try {
      const headers = this.auth.getBearerHeaders();
      const result = await firstValueFrom(this.http.get<ChatSettings>(this.baseUrl, { headers }));
      this.autoTranslate.set(result.autoTranslate);
      this.readReceipts.set(result.readReceipts);
      this.enterToSend.set(result.enterToSend);
      this.textSize.set(result.textSize ?? 'medium');
      this.disappearingMessagesTtl.set(
        this.normalizeDisappearingMessagesTtl(result.disappearingMessagesTtl),
      );
    } catch {
      // Do not claim a destructive setting is off when the authoritative value
      // could not be read. The UI disables retention editing until a retry works.
      this.settingsLoadError.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  async updateSetting(key: keyof ChatSettings, value: ChatSettingValue): Promise<void> {
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

  async updateDisappearingMessagesTtl(value: DisappearingMessagesTtl): Promise<boolean> {
    if (this.disappearingMessagesSaving() || this.settingsLoadError()) return false;

    const previous = this.disappearingMessagesTtl();
    this.disappearingMessagesSaving.set(true);
    this.disappearingMessagesError.set(false);
    this.disappearingMessagesTtl.set(value);

    try {
      const headers = this.auth.getBearerHeaders();
      await firstValueFrom(
        this.http.put(this.baseUrl, { disappearingMessagesTtl: value }, { headers }),
      );
      return true;
    } catch {
      this.disappearingMessagesTtl.set(previous);
      this.disappearingMessagesError.set(true);
      return false;
    } finally {
      this.disappearingMessagesSaving.set(false);
    }
  }

  async resetToDefaults(): Promise<boolean> {
    const previous = {
      autoTranslate: this.autoTranslate(),
      readReceipts: this.readReceipts(),
      enterToSend: this.enterToSend(),
      textSize: this.textSize(),
      disappearingMessagesTtl: this.disappearingMessagesTtl(),
    };

    this.autoTranslate.set(false);
    this.readReceipts.set(false);
    this.enterToSend.set(false);
    this.textSize.set('medium');
    this.disappearingMessagesTtl.set('off');
    this.disappearingMessagesError.set(false);

    try {
      const headers = this.auth.getBearerHeaders();
      await firstValueFrom(
        this.http.put(
          this.baseUrl,
          {
            autoTranslate: false,
            readReceipts: false,
            enterToSend: false,
            disappearingMessagesTtl: 'off',
          },
          { headers },
        ),
      );
      return true;
    } catch {
      this.autoTranslate.set(previous.autoTranslate);
      this.readReceipts.set(previous.readReceipts);
      this.enterToSend.set(previous.enterToSend);
      this.textSize.set(previous.textSize);
      this.disappearingMessagesTtl.set(previous.disappearingMessagesTtl);
      this.disappearingMessagesError.set(true);
      return false;
    }
  }

  private normalizeDisappearingMessagesTtl(value: unknown): DisappearingMessagesTtl {
    return value === '24h' || value === '7d' || value === '90d' ? value : 'off';
  }

  private getLocal(key: keyof ChatSettings): ChatSettingValue {
    switch (key) {
      case 'autoTranslate':
        return this.autoTranslate();
      case 'readReceipts':
        return this.readReceipts();
      case 'enterToSend':
        return this.enterToSend();
      case 'textSize':
        return this.textSize();
      case 'disappearingMessagesTtl':
        return this.disappearingMessagesTtl();
    }
  }

  private setLocal(key: keyof ChatSettings, value: ChatSettingValue): void {
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
      case 'disappearingMessagesTtl':
        this.disappearingMessagesTtl.set(this.normalizeDisappearingMessagesTtl(value));
        break;
    }
  }
}
