import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class LockServiceService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/chat`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async lockChat(roomId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/rooms/${roomId}/lock`, {}, { headers: this.getHeaders() }),
    );
  }

  async unlockChat(roomId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/rooms/${roomId}/unlock`, {}, { headers: this.getHeaders() }),
    );
  }

  async getLockedRoomIds(): Promise<string[]> {
    return firstValueFrom(
      this.http.get<string[]>(`${this.baseUrl}/locked-rooms`, { headers: this.getHeaders() }),
    );
  }
}
