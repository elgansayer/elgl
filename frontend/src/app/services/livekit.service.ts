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
  Track,
} from 'livekit-client';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface TokenResponse {
  token: string;
  ice_servers: IceServer[];
}

/** Fallback ICE servers when the backend does not return any. */
const FALLBACK_ICE_SERVERS: IceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

@Injectable({
  providedIn: 'root',
})
export class LivekitService {
  private http = inject(HttpClient);
  onTrackSubscribed?: (track: RemoteTrack, publication: unknown) => void;

  private room: Room | null = null;
  private _localAudioTrack: LocalTrack | null = null;
  private _muted = false;
  private _speakerphone = false;

  private createRoom(options: RoomOptions): Room {
    return new Room(options);
  }

  /**
   * Get a LiveKit access token and ICE server configuration from the
   * backend.  The ICE servers are used for NAT traversal and are
   * critical for users on strict corporate networks.
   */
  async getTokenAndIceServers(
    roomName: string,
    participantIdentity: string,
  ): Promise<{ token: string; iceServers: IceServer[] }> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${environment.apiUrl}/livekit/token`, {
        room_name: roomName,
        participant_identity: participantIdentity,
      }),
    );
    return {
      token: response.token,
      iceServers: response.ice_servers?.length
        ? response.ice_servers
        : FALLBACK_ICE_SERVERS,
    };
  }

  /** @deprecated Use {@link getTokenAndIceServers} for proper ICE config. */
  async getToken(roomName: string, participantIdentity: string): Promise<string> {
    const result = await this.getTokenAndIceServers(roomName, participantIdentity);
    return result.token;
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
    const { token, iceServers } = await this.getTokenAndIceServers(
      roomName,
      userId,
    );
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

    const room = this.createRoom(roomOptions);
    this.room = room;
    await room.connect(this.getLiveKitUrl(), token, {
      rtcConfig: { iceServers },
    });
    return room;
  }

  async publishTracks(): Promise<{ audioTrack: LocalTrack | null; videoTrack: LocalTrack | null }> {
    if (!this.room) {
      return { audioTrack: null, videoTrack: null };
    }
    await this.room.localParticipant.setMicrophoneEnabled(true);
    const pub = this.room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const audioTrack = pub?.track ?? null;
    this._localAudioTrack = audioTrack;
    return { audioTrack, videoTrack: null };
  }

  /** Toggle the local audio track's mute state and return the new state. */
  async toggleMute(): Promise<boolean> {
    if (this._localAudioTrack) {
      if (this._localAudioTrack.isMuted) {
        await this._localAudioTrack.unmute();
      } else {
        await this._localAudioTrack.mute();
      }
      this._muted = this._localAudioTrack.isMuted;
    } else {
      this._muted = !this._muted;
    }
    return this._muted;
  }

  /** Toggle the speakerphone (loudspeaker) state and return the new state. */
  toggleSpeakerphone(): boolean {
    this._speakerphone = !this._speakerphone;
    // In a production app we would also ask the user to select an audio
    // output device via navigator.mediaDevices.enumerateDevices(), but
    // for now we simply keep an internal flag so the UI can reflect it.
    return this._speakerphone;
  }

  /** Start or stop screen sharing based on the enabled flag. */
  async toggleScreenShare(enabled: boolean, room?: Room): Promise<void> {
    const targetRoom = room ?? this.room;
    if (!targetRoom) return;
    await targetRoom.localParticipant.setScreenShareEnabled(enabled);
  }

  leaveRoom(): void {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    this._localAudioTrack = null;
  }
}
