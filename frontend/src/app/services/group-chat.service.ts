import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface GroupChatDetails {
  id: string;
  type: 'group';
  title: string;
  topic: string | null;
  avatar_url: string | null;
  admin_id: string;
  max_members: number;
  member_count: number;
  created_at: string;
}

export interface GroupChatMemberDetails {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class GroupChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat/groups`;

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.auth.getAccessToken() ?? ''}` };
  }

  get(roomId: string): Promise<GroupChatDetails> {
    return firstValueFrom(
      this.http.get<GroupChatDetails>(`${this.baseUrl}/${roomId}`, {
        headers: this.headers(),
      }),
    );
  }

  members(roomId: string): Promise<GroupChatMemberDetails[]> {
    return firstValueFrom(
      this.http.get<GroupChatMemberDetails[]>(`${this.baseUrl}/${roomId}/members`, {
        headers: this.headers(),
      }),
    );
  }

  update(
    roomId: string,
    changes: { name?: string; topic?: string; avatarUrl?: string },
  ): Promise<GroupChatDetails> {
    return firstValueFrom(
      this.http.patch<GroupChatDetails>(`${this.baseUrl}/${roomId}`, changes, {
        headers: this.headers(),
      }),
    );
  }

  addMembers(roomId: string, memberIds: string[]): Promise<GroupChatMemberDetails[]> {
    return firstValueFrom(
      this.http.post<GroupChatMemberDetails[]>(
        `${this.baseUrl}/${roomId}/members`,
        { memberIds },
        { headers: this.headers() },
      ),
    );
  }

  removeMember(roomId: string, memberId: string): Promise<{ success: true }> {
    return firstValueFrom(
      this.http.delete<{ success: true }>(`${this.baseUrl}/${roomId}/members/${memberId}`, {
        headers: this.headers(),
      }),
    );
  }

  transferAdmin(roomId: string, memberId: string): Promise<GroupChatDetails> {
    return firstValueFrom(
      this.http.post<GroupChatDetails>(
        `${this.baseUrl}/${roomId}/admin`,
        { memberId },
        { headers: this.headers() },
      ),
    );
  }

  leave(roomId: string): Promise<{ deleted: boolean }> {
    return firstValueFrom(
      this.http.post<{ deleted: boolean }>(
        `${this.baseUrl}/${roomId}/leave`,
        {},
        { headers: this.headers() },
      ),
    );
  }
}
