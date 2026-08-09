import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatBackupService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl ?? '/api';

  /**
   * Exports all messages of a channel as a downloadable JSON file.
   */
  async exportChannel(channelId: string): Promise<ArrayBuffer> {
    const url = `${this.apiBase}/chat-backup/export/${encodeURIComponent(channelId)}`;
    const response = await lastValueFrom(
      this.http.get(url, { responseType: 'arraybuffer' }),
    );
    return response;
  }

  /**
   * Imports previously exported messages back into a channel.
   */
  async importChannel(
    channelId: string,
    messages: Record<string, unknown>[],
  ): Promise<number> {
    const url = `${this.apiBase}/chat-backup/import/${encodeURIComponent(channelId)}`;
    const body: { messages: Record<string, unknown>[] } = { messages };
    const response = await lastValueFrom(
      this.http.post<{ importedCount: number }>(url, body),
    );
    return response.importedCount;
  }
}
