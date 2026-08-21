import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StudyBuddiesService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  async follow(targetUserId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/study-buddies/follow`, { targetUserId }),
    );
  }

  async unfollow(targetUserId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/study-buddies/unfollow`, {
        body: { targetUserId },
      }),
    );
  }

  async getOrCreateChannel(partnerId: string): Promise<{ channel: string }> {
    return firstValueFrom(
      this.http.get<{ channel: string }>(`${this.apiUrl}/study-buddies/channel`, {
        params: { partnerId },
      }),
    );
  }
}
