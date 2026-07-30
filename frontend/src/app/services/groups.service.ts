import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatGroup {
  id: string;
  name: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class GroupsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/groups`;

  createGroup(name: string, communityId?: string): Promise<ChatGroup> {
    const body: Record<string, unknown> = { name };
    if (communityId) {
      body['community_id'] = communityId;
    }
    return firstValueFrom(this.http.post<ChatGroup>(this.apiUrl, body));
  }

  renameGroup(groupId: string, name: string): Promise<ChatGroup> {
    return firstValueFrom(this.http.put<ChatGroup>(`${this.apiUrl}/${groupId}/rename`, { name }));
  }

  addMember(groupId: string, userId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/${groupId}/members`, {
        user_id: userId,
      }),
    );
  }

  removeMember(groupId: string, userId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.delete<{ success: boolean }>(`${this.apiUrl}/${groupId}/members/${userId}`),
    );
  }

  generateInviteCode(roomId: string): Promise<{ code: string }> {
    return firstValueFrom(
      this.http.post<{ code: string }>(`${this.apiUrl}/${roomId}/invite-code`, {}),
    );
  }

  joinByInviteCode(code: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/join-by-code`, { code }),
    );
  }
}
