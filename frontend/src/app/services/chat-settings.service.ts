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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTextSize(value: unknown): value is ChatSettings['textSize'] {
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
  readonly textSize = signal<'small' | 'medium' | 'large'>('medium');
  readonly disappearingMessagesTtl = signal<DisappearingMessagesTtl>('off');
  readonly disappearingMessagesSaving = signal<boolean>(false);
  readonly disappearingMessagesError = signal<boolean>(false);
  readonly settingsLoadError = signal<boolean>(false);
  readonly settingSaving = signal<boolean>(false);
  readonly settingSaveError = signal<boolean>(false);
  readonly loaded = signal<boolean>(false);

  /** Loads the authoritative chat settings; resolves false when they could not be read. */
  async loadSettings(): Promise<boolean> {
    this.loaded.set(false);
    this.settingsLoadError.set(false);
    try {
      const headers = this.auth.getBearerHeaders();
      const result = await firstValueFrom(this.http.get<unknown>(this.baseUrl, { headers }));
      // A malformed payload is treated as unreadable, never as authoritative state.
      if (!isRecord(result)) {
        throw new Error('Invalid chat settings response');
      }
      this.autoTranslate.set(result['autoTranslate'] === true);
      this.readReceipts.set(result['readReceipts'] === true);
      this.enterToSend.set(result['enterToSend'] === true);
      this.textSize.set(isTextSize(result['textSize']) ? result['textSize'] : 'medium');
      this.disappearingMessagesTtl.set(
        this.normalizeDisappearingMessagesTtl(result['disappearingMessagesTtl']),
      );
      return true;
    } catch {
      // Do not claim a destructive setting is off when the authoritative value
      // could not be read. The UI disables retention editing until a retry works.
      this.settingsLoadError.set(true);
      return false;
    } finally {
      this.loaded.set(true);
    }
  }

  /**
   * Persists one setting optimistically. Rejects invalid values, overlapping
   * saves and edits while the authoritative state is unreadable; a failed save
   * is reverted and surfaced through settingSaveError.
   */
  async updateSetting(key: keyof ChatSettings, value: ChatSettingValue): Promise<boolean> {
    if (this.settingSaving() || this.settingsLoadError() || !this.isValidSettingValue(key, value)) {
      return false;
    }

    const previous = this.getLocal(key);
    this.settingSaving.set(true);
    this.settingSaveError.set(false);
    this.setLocal(key, value);
    try {
      const headers = this.auth.getBearerHeaders();
      await firstValueFrom(this.http.put(this.baseUrl, { [key]: value }, { headers }));
      return true;
    } catch {
      this.setLocal(key, previous);
      this.settingSaveError.set(true);
      return false;
    } finally {
      this.settingSaving.set(false);
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

  private isValidSettingValue(key: keyof ChatSettings, value: ChatSettingValue): boolean {
    switch (key) {
      case 'autoTranslate':
      case 'readReceipts':
      case 'enterToSend':
        return typeof value === 'boolean';
      case 'textSize':
        return isTextSize(value);
      case 'disappearingMessagesTtl':
        return this.normalizeDisappearingMessagesTtl(value) === value;
    }
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
