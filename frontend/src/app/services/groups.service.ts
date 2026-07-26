import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatGroup {
  id: string;
  name: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class GroupsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/groups`;

  createGroup(name: string): Observable<ChatGroup> {
    return this.http.post<ChatGroup>(this.apiUrl, { name });
  }

  renameGroup(groupId: string, name: string): Observable<ChatGroup> {
    return this.http.put<ChatGroup>(`${this.apiUrl}/${groupId}/rename`, { name });
  }

  addMember(groupId: string, userId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/${groupId}/members`, { user_id: userId });
  }

  removeMember(groupId: string, userId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${groupId}/members/${userId}`);
  }
}
