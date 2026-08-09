import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BlockedUser {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_language?: string;
  target_languages?: string[];
}

@Injectable({ providedIn: 'root' })
export class BlockService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/blocks`;

  readonly blockedUsers = signal<BlockedUser[]>([]);

  async loadBlockedUsers(): Promise<void> {
    try {
      const users = await firstValueFrom(this.http.get<BlockedUser[]>(this.apiUrl));
      this.blockedUsers.set(users ?? []);
    } catch {
      this.blockedUsers.set([]);
    }
  }

  async blockUser(blockedId: string): Promise<{ success: boolean }> {
    const result = await firstValueFrom(
      this.http.post<{ success: boolean }>(this.apiUrl, { blocked_id: blockedId }),
    );
    await this.loadBlockedUsers();
    return result;
  }

  async unblockUser(blockedId: string): Promise<{ success: boolean }> {
    const result = await firstValueFrom(
      this.http.delete<{ success: boolean }>(`${this.apiUrl}/${blockedId}`),
    );
    this.blockedUsers.update((prev) => prev.filter((u) => u.id !== blockedId));
    return result;
  }
}
