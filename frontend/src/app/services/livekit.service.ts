import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Room,
  LocalTrack,
  RemoteTrack,
  RoomOptions,
  ExternalE2EEKeyProvider,
} from 'livekit-client';

@Injectable({
  providedIn: 'root',
})
export class LivekitService {
  private http = inject(HttpClient);
  onTrackSubscribed?: (track: RemoteTrack, publication: unknown) => void;

  /**
   * Get a LiveKit access token from the backend.
   */
  async getToken(roomName: string, participantIdentity: string): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<{ token: string }>(`${environment.apiUrl}/livekit/token`, {
        room_name: roomName,
        participant_identity: participantIdentity,
      }),
    );
    return response.token;
  }

  /**
   * Get the LiveKit WebSocket URL.
   */
  getLiveKitUrl(): string {
    return environment.liveKitUrl;
  }

  async joinRoom(
    roomName: string,
    userId: string,
    _isVideoCall: boolean,
    e2eeKey?: string,
  ): Promise<Room> {
    let roomOptions: RoomOptions = {};

    if (e2eeKey) {
      const keyProvider = new ExternalE2EEKeyProvider();
      roomOptions = {
        e2ee: {
          keyProvider,
          worker: new Worker(new URL('./livekit-e2ee.worker', import.meta.url), {
            type: 'module',
          }),
        },
      };
      await keyProvider.setKey(e2eeKey);
    }

    const room = new Room(roomOptions);
    return room;
  }

  async publishTracks(): Promise<{ audioTrack: LocalTrack | null; videoTrack: LocalTrack | null }> {
    return { audioTrack: null, videoTrack: null };
  }

  leaveRoom(): void {
    // stub
  }
}
