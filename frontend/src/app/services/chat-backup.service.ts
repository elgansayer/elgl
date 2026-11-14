import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatBackupMessage {
  message_type: string;
  text_content: string | null;
  media_url: string | null;
  correction_payload: Record<string, unknown> | null;
  sender_id: string;
  created_at: string;
}

export interface ChatBackupDocument {
  room_id: string;
  exported_at: string;
  messages: ChatBackupMessage[];
}

@Injectable({ providedIn: 'root' })
export class ChatBackupService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl ?? '/api';

  /**
   * Exports every message of a room the caller belongs to.
   */
  async exportRoom(roomId: string): Promise<ChatBackupDocument> {
    const url = `${this.apiBase}/chat-backup/export/${encodeURIComponent(roomId)}`;
    return lastValueFrom(this.http.get<ChatBackupDocument>(url));
  }

  /**
   * Imports a previously exported backup document into the same room. The API
   * attributes every imported message to the caller, so the stored sender of
   * the original document is informational only.
   */
  async importRoom(
    roomId: string,
    messages: ReadonlyArray<Record<string, unknown>>,
  ): Promise<number> {
    const url = `${this.apiBase}/chat-backup/import/${encodeURIComponent(roomId)}`;
    const response = await lastValueFrom(
      this.http.post<{ importedCount: number }>(url, { messages }),
    );
    return response.importedCount;
  }
}
