import { Injectable, inject } from '@angular/core';
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

  async getBlockedUsers(): Promise<BlockedUser[]> {
    return firstValueFrom(this.http.get<BlockedUser[]>(this.apiUrl));
  }

  async blockUser(blockedId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(this.apiUrl, { blocked_id: blockedId }),
    );
  }

  async unblockUser(blockedId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.delete<{ success: boolean }>(`${this.apiUrl}/${blockedId}`),
    );
  }
}
