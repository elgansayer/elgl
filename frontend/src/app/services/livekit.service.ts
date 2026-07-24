import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Room, LocalTrack, RemoteTrack } from 'livekit-client';

@Injectable({
  providedIn: 'root'
})
export class LivekitService {
  private http = inject(HttpClient);
  onTrackSubscribed?: (track: RemoteTrack, publication: any) => void;

  /**
   * Get a LiveKit access token from the backend.
   */
  async getToken(roomName: string, participantIdentity: string): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<{ token: string }>(
        `${environment.apiUrl}/livekit/token`,
        {
          room_name: roomName,
          participant_identity: participantIdentity,
        }
      )
    );
    return response.token;
  }

  /**
   * Get the LiveKit WebSocket URL.
   */
  getLiveKitUrl(): string {
    return environment.liveKitUrl;
  }

  async joinRoom(roomName: string, userId: string, isVideoCall: boolean): Promise<Room> {
    const room = new Room();
    return room;
  }

  async publishTracks(isVideoCall: boolean): Promise<{ audioTrack: LocalTrack | null, videoTrack: LocalTrack | null }> {
    return { audioTrack: null, videoTrack: null };
  }

  leaveRoom(): void {
    // stub
  }
}
