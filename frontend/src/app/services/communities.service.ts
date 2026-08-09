import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Community {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
}

export interface CommunityGroup {
  id: string;
  name: string;
  owner_id: string;
  max_members: number;
  created_at: string;
}

export interface CreateCommunityPayload {
  name: string;
  description?: string;
}

export interface UpdateCommunityPayload {
  name?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CommunitiesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/communities`;

  create(payload: CreateCommunityPayload): Promise<Community> {
    return firstValueFrom(this.http.post<Community>(this.apiUrl, payload));
  }

  listMine(): Promise<Community[]> {
    return firstValueFrom(this.http.get<Community[]>(this.apiUrl));
  }

  get(communityId: string): Promise<Community> {
    return firstValueFrom(
      this.http.get<Community>(`${this.apiUrl}/${communityId}`),
    );
  }

  update(
    communityId: string,
    payload: UpdateCommunityPayload,
  ): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.patch<{ success: boolean }>(
        `${this.apiUrl}/${communityId}`,
        payload,
      ),
    );
  }

  remove(communityId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/${communityId}`),
    );
  }

  addGroup(communityId: string, groupId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/${communityId}/groups`, {
        groupId,
      }),
    );
  }

  removeGroup(
    communityId: string,
    groupId: string,
  ): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.delete<{ success: boolean }>(
        `${this.apiUrl}/${communityId}/groups/${groupId}`,
      ),
    );
  }

  getGroups(communityId: string): Promise<CommunityGroup[]> {
    return firstValueFrom(
      this.http.get<CommunityGroup[]>(`${this.apiUrl}/${communityId}/groups`),
    );
  }
}
