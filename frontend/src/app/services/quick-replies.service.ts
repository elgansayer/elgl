import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface QuickReply {
  id: string;
  key: string;
}

export interface CreateQuickReplyDto {
  id: string;
  key: string;
}

@Injectable({ providedIn: 'root' })
export class QuickRepliesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getQuickReplies(): Promise<QuickReply[]> {
    return firstValueFrom(
      this.http.get<QuickReply[]>(`${this.apiUrl}/chat/quick-replies`),
    );
  }

  createQuickReply(dto: CreateQuickReplyDto): Promise<QuickReply> {
    return firstValueFrom(
      this.http.post<QuickReply>(`${this.apiUrl}/chat/quick-replies`, dto),
    );
  }
}
