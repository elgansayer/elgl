import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface LiveKitTokenResponse {
  token: string;
  roomName: string;
}

@Injectable({
  providedIn: 'root'
})
export class LivekitService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private room: any = null;
  private localAudioTrack: any = null;
  private localVideoTrack: any = null;

  readonly isConnected = signal(false);
  readonly participants = signal<any[]>([]);

  onTrackSubscribed: ((track: MediaStreamTrack) => void) | null = null;

  async getToken(roomName: string): Promise<LiveKitTokenResponse> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) throw new Error('User not authenticated');

    const response = await firstValueFrom(
      this.http.post<LiveKitTokenResponse>(
        `${environment.apiUrl}/livekit/token`,
        { roomName, userId: currentUser.id }
      )
    );

    if (!response) throw new Error('Failed to get LiveKit token');
    return response;
  }

  async joinRoom(roomName: string, userId: string, enableVideo: boolean = false): Promise<void> {
    const { token } = await this.getToken(roomName);

    // Dynamically import LiveKit SDK
    const { Room, RoomEvent, VideoPresets } = await import('livekit-client');

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: any) => {
      if (this.onTrackSubscribed) {
        this.onTrackSubscribed(track.mediaStreamTrack);
      }
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant: any) => {
      this.participants.update(p => [...p, participant]);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: any) => {
      this.participants.update(p => p.filter(pp => pp.sid !== participant.sid));
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.isConnected.set(false);
      this.participants.set([]);
    });

    await this.room.connect(environment.livekitUrl, token);
    this.isConnected.set(true);
  }

  async publishTracks(enableVideo: boolean = false): Promise<void> {
    if (!this.room) throw new Error('Not connected to a room');

    const { createLocalAudioTrack, createLocalVideoTrack } = await import('livekit-client');

    // Publish audio
    this.localAudioTrack = await createLocalAudioTrack();
    await this.room.localParticipant.publishTrack(this.localAudioTrack);

    // Publish video if enabled
    if (enableVideo) {
      this.localVideoTrack = await createLocalVideoTrack();
      await this.room.localParticipant.publishTrack(this.localVideoTrack);
    }
  }

  leaveRoom(): void {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.isConnected.set(false);
    this.participants.set([]);
  }
}
