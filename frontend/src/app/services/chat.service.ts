import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface CorrectionPayload {
  original: string;
  corrected: string;
  explanation?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: 'text' | 'voice' | 'correction' | 'doodle';
  text_content?: string;
  media_url?: string;
  correction_payload?: CorrectionPayload;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}

export interface FavouriteRecord {
  id: string;
  user_id: string;
  message_id: string;
  note_text?: string;
  created_at: string;
  message?: ChatMessage;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/chat`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`
    };
  }

  async sendMessage(payload: {
    room_id: string;
    message_type: 'text' | 'voice' | 'correction' | 'doodle';
    text_content?: string;
    media_url?: string;
    correction_payload?: CorrectionPayload;
  }): Promise<ChatMessage> {
    return firstValueFrom(
      this.http.post<ChatMessage>(`${this.baseUrl}/messages`, payload, { headers: this.getHeaders() })
    );
  }

  async getMessages(roomId: string, search?: string): Promise<ChatMessage[]> {
    let params = new HttpParams();
    if (search && search.trim().length > 0) {
      params = params.set('search', search.trim());
    }
    return firstValueFrom(
      this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${roomId}`, { headers: this.getHeaders(), params })
    );
  }

  async addFavourite(messageId: string, noteText?: string): Promise<FavouriteRecord> {
    return firstValueFrom(
      this.http.post<FavouriteRecord>(
        `${this.baseUrl}/favourites`,
        { message_id: messageId, note_text: noteText },
        { headers: this.getHeaders() }
      )
    );
  }

  async getFavourites(): Promise<FavouriteRecord[]> {
    return firstValueFrom(
      this.http.get<FavouriteRecord[]>(`${this.baseUrl}/favourites`, { headers: this.getHeaders() })
    );
  }
}
