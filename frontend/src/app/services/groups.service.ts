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

  createGroup(name: string): Promise<ChatGroup> {
    return firstValueFrom(this.http.post<ChatGroup>(this.apiUrl, { name }));
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
}
