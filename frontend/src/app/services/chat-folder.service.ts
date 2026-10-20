import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatRoom } from './chat.service';

@Injectable({ providedIn: 'root' })
export class ChatFolderService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat/folders`;

  async getArchivedRooms(): Promise<ChatRoom[]> {
    return this.getFolder('archived');
  }

  async getHiddenRooms(): Promise<ChatRoom[]> {
    return this.getFolder('hidden');
  }

  async archiveRoom(roomId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/archived/${encodeURIComponent(roomId)}`,
        {},
        { headers: this.headers() },
      ),
    );
  }

  async unarchiveRoom(roomId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/archived/${encodeURIComponent(roomId)}`, {
        headers: this.headers(),
      }),
    );
  }

  private async getFolder(folder: 'archived' | 'hidden'): Promise<ChatRoom[]> {
    if (!this.authService.getAccessToken()) return [];
    return firstValueFrom(
      this.http.get<ChatRoom[]>(`${this.baseUrl}/${folder}`, {
        headers: this.headers(),
      }),
    );
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}`,
    });
  }
}
