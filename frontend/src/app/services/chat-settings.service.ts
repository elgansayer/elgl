import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatSettings {
  autoTranslate: boolean;
  readReceipts: boolean;
  enterToSend: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatSettingsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/chat/settings`;

  readonly autoTranslate = signal<boolean>(false);
  readonly readReceipts = signal<boolean>(false);
  readonly enterToSend = signal<boolean>(false);
  readonly loaded = signal<boolean>(false);

  async loadSettings(): Promise<void> {
    try {
      const result = await firstValueFrom(this.http.get<ChatSettings>(this.baseUrl));
      this.autoTranslate.set(result.autoTranslate);
      this.readReceipts.set(result.readReceipts);
      this.enterToSend.set(result.enterToSend);
      this.loaded.set(true);
    } catch {
      // fallback to defaults
      this.autoTranslate.set(false);
      this.readReceipts.set(false);
      this.enterToSend.set(false);
      this.loaded.set(true);
    }
  }

  async updateSetting(
    key: keyof ChatSettings,
    value: boolean,
  ): Promise<void> {
    this.setLocal(key, value);
    try {
      await this.http.put(this.baseUrl, { [key]: value }).toPromise();
    } catch {
      // revert on failure
      this.setLocal(key, !value);
    }
  }

  private setLocal(key: keyof ChatSettings, value: boolean): void {
    switch (key) {
      case 'autoTranslate':
        this.autoTranslate.set(value);
        break;
      case 'readReceipts':
        this.readReceipts.set(value);
        break;
      case 'enterToSend':
        this.enterToSend.set(value);
        break;
    }
  }
}
