import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatGroup {
  id: string;
  name: string;
  created_at: string;
  owner_id?: string;
  max_members?: number;
  member_count?: number;
  is_member?: boolean;
}

export interface ChatAnnouncement {
  id: string;
  message: string;
  createdAt: string;
  senderId: string;
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

  restrictSendMessages(groupId: string, canSendMessages: boolean): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.apiUrl}/${groupId}/restrict-send-messages`, {
        canSendMessages,
      }),
    );
  }

  restrictEditInfo(groupId: string, canEditInfo: boolean): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.apiUrl}/${groupId}/restrict-edit-info`, {
        canEditInfo,
      }),
    );
  }

  renameGroup(groupId: string, name: string): Promise<ChatGroup> {
    return firstValueFrom(this.http.put<ChatGroup>(`${this.apiUrl}/${groupId}/rename`, { name }));
  }

  getMyGroups(): Promise<ChatGroup[]> {
    return firstValueFrom(this.http.get<ChatGroup[]>(`${this.apiUrl}/mine`));
  }

  addMember(groupId: string, userId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/${groupId}/add-member`, {
        memberId: userId,
      }),
    );
  }

  removeMember(groupId: string, userId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/${groupId}/remove-member`, {
        memberId: userId,
      }),
    );
  }

  generateInviteCode(roomId: string): Promise<{ code: string }> {
    return firstValueFrom(
      this.http.post<{ code: string }>(`${this.apiUrl}/${roomId}/invite-code`, {}),
    );
  }

  generateInviteLink(roomId: string): Promise<{ code: string; url: string }> {
    return firstValueFrom(
      this.http.get<{ code: string; url: string }>(
        `${this.apiUrl}/${roomId}/invite-link`,
      ),
    );
  }

  getInviteInfo(code: string): Promise<{ roomId: string; title: string }> {
    return firstValueFrom(
      this.http.get<{ roomId: string; title: string }>(
        `${this.apiUrl}/invite-info/${code}`,
      ),
    );
  }

  joinGroupByCode(code: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/join-by-code`, { code }),
    );
  }

  sendAnnouncement(groupId: string, message: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/${groupId}/announcement`, { message }),
    );
  }

  getAnnouncements(groupId: string): Promise<ChatAnnouncement[]> {
    return firstValueFrom(
      this.http.get<ChatAnnouncement[]>(`${this.apiUrl}/${groupId}/announcements`),
    );
  }

  createAnnouncementGroup(name: string, memberIds: string[]): Promise<ChatGroup> {
    return firstValueFrom(
      this.http.post<ChatGroup>(`${this.apiUrl}/announcement-group`, {
        name,
        memberIds,
      }),
    );
  }

  broadcastMessage(groupId: string, message: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/${groupId}/broadcast`, {
        message,
      }),
    );
  }

  getDiscoverableGroups(): Promise<DiscoverableGroup[]> {
    return firstValueFrom(
      this.http.get<DiscoverableGroup[]>(`${this.apiUrl}/discoverable`)
    );
  }

  joinGroup(groupId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/${groupId}/join`, {})
    );
  }
}

export interface DiscoverableGroup {
  id: string;
  name: string;
  owner_id: string;
  max_members: number;
  member_count: number;
  is_member: boolean;
  interest_id?: string;
  created_at: string;
}
