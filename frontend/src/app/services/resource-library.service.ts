import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ResourceItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  category?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  type?: string;
  content?: string;
}

export interface CreateResourcePayload {
  title: string;
  description?: string;
  url: string;
  category?: string;
  type?: string;
  content?: string;
}

export interface UpdateResourcePayload {
  title?: string;
  description?: string;
  url?: string;
  category?: string;
  type?: string;
  content?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ResourceLibraryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/resource-library`;

  async getAll(): Promise<ResourceItem[]> {
    return firstValueFrom(this.http.get<ResourceItem[]>(this.baseUrl));
  }

  async getById(id: string): Promise<ResourceItem> {
    return firstValueFrom(this.http.get<ResourceItem>(`${this.baseUrl}/${id}`));
  }

  async create(payload: CreateResourcePayload): Promise<ResourceItem> {
    return firstValueFrom(this.http.post<ResourceItem>(this.baseUrl, payload));
  }

  async update(id: string, payload: UpdateResourcePayload): Promise<ResourceItem> {
    return firstValueFrom(this.http.patch<ResourceItem>(`${this.baseUrl}/${id}`, payload));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
  }
}
