import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface LanguageIsland {
  id: string;
  name: string;
  description: string | null;
  language_pair: string;
  host_id: string;
  max_members: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface QueryLanguageIslands {
  language_pair?: string;
  page?: number;
  limit?: number;
}

export interface CreateLanguageIslandDto {
  name: string;
  description?: string;
  language_pair: string;
  max_members?: number;
}

export interface UpdateLanguageIslandDto {
  name?: string;
  description?: string;
  language_pair?: string;
  max_members?: number;
}

@Injectable({ providedIn: 'root' })
export class LanguageIslandsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/language-islands`;

  listIslands(query: QueryLanguageIslands = {}): Promise<LanguageIsland[]> {
    const params: Record<string, string | number> = {};
    if (query.language_pair) params['language_pair'] = query.language_pair;
    if (query.page) params['page'] = query.page;
    if (query.limit) params['limit'] = query.limit;
    return firstValueFrom(
      this.http.get<LanguageIsland[]>(this.baseUrl, { params }),
    );
  }

  getIsland(id: string): Promise<LanguageIsland> {
    return firstValueFrom(
      this.http.get<LanguageIsland>(`${this.baseUrl}/${id}`),
    );
  }

  createIsland(dto: CreateLanguageIslandDto): Promise<LanguageIsland> {
    return firstValueFrom(
      this.http.post<LanguageIsland>(this.baseUrl, dto),
    );
  }

  updateIsland(
    id: string,
    dto: UpdateLanguageIslandDto,
  ): Promise<LanguageIsland> {
    return firstValueFrom(
      this.http.patch<LanguageIsland>(`${this.baseUrl}/${id}`, dto),
    );
  }

  deleteIsland(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${id}`),
    );
  }

  joinIsland(id: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/${id}/join`, {}),
    );
  }

  leaveIsland(id: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/${id}/leave`, {}),
    );
  }

  getMyIslands(): Promise<LanguageIsland[]> {
    return firstValueFrom(
      this.http.get<LanguageIsland[]>(`${this.baseUrl}/my`),
    );
  }
}
