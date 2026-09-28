import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const MAX_ARCHIVED_ROOMS = 500;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable({ providedIn: 'root' })
export class ChatArchiveService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat`;

  async getArchivedRoomIds(): Promise<string[]> {
    const token = this.authService.getAccessToken();
    if (!token) {
      return [];
    }

    const response = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/archived-rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return this.validateArchivedRoomIds(response);
  }

  async archiveRoom(roomId: string): Promise<void> {
    await this.updateArchiveState(roomId, true);
  }

  async unarchiveRoom(roomId: string): Promise<void> {
    await this.updateArchiveState(roomId, false);
  }

  private async updateArchiveState(roomId: string, archived: boolean): Promise<void> {
    if (!UUID_V4.test(roomId)) {
      throw new Error('Invalid chat room identifier');
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const action = archived ? 'archive' : 'unarchive';
    const response = await firstValueFrom(
      this.http.post<unknown>(
        `${this.baseUrl}/rooms/${roomId}/${action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    if (
      typeof response !== 'object' ||
      response === null ||
      Array.isArray(response) ||
      (response as Record<string, unknown>)['success'] !== true
    ) {
      throw new Error('Invalid chat archive response');
    }
  }

  private validateArchivedRoomIds(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > MAX_ARCHIVED_ROOMS) {
      throw new Error('Invalid archived chats response');
    }

    const result: string[] = [];
    const seen = new Set<string>();
    for (const candidate of value) {
      if (typeof candidate !== 'string' || !UUID_V4.test(candidate) || seen.has(candidate)) {
        throw new Error('Invalid archived chats response');
      }
      seen.add(candidate);
      result.push(candidate);
    }
    return result;
  }
}
