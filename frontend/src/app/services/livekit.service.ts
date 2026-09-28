import { Injectable, inject, signal } from '@angular/core';
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

/** ICE server descriptor returned by the backend token endpoint. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface VideoClassroomTokenResponse {
  token: string;
  roomName: string;
  iceServers?: IceServer[];
  degraded?: boolean;
  degradationReason?: string;
}

export interface TokenFetchResult {
  token: string;
  iceServers?: IceServer[];
  degraded: boolean;
  degradationReason?: string;
}

const MAX_ROOM_CONNECT_RETRIES = 3;
const ROOM_CONNECT_BASE_DELAY_MS = 800;

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
  private e2eeWorker: Worker | null = null;

  /** Signal indicating whether the current connection is in a degraded state */
  readonly isDegraded = signal(false);
  /** Signal with human-readable degradation reason */
  readonly degradationReason = signal<string | null>(null);
  /** Signal indicating whether LiveKit SFU connection is active */
  readonly livekitConnected = signal(false);

  private createRoom(options: RoomOptions): Room {
    return new Room(options);
  }

  /**
   * Get a LiveKit access token from the backend. Returns both the token
   * and whether the response was served from a degraded fallback.
   */
  async getToken(
    roomName: string,
    _participantIdentity: string,
  ): Promise<TokenFetchResult> {
    const response = await firstValueFrom(
      this.http.post<VideoClassroomTokenResponse>(
        `${environment.apiUrl}/video-calls/accept`,
        {
          roomName: roomName,
        },
      ),
    );
    return {
      token: response.token,
      iceServers: response.iceServers,
      degraded: response.degraded ?? false,
      degradationReason: response.degradationReason,
    };
  }

  /**
   * Start a new video call room. Returns token and whether degraded.
   */
  async startRoom(
    _userId: string,
  ): Promise<{ token: string; roomName: string; iceServers?: IceServer[]; degraded: boolean; degradationReason?: string }> {
    const response = await firstValueFrom(
      this.http.post<VideoClassroomTokenResponse>(
        `${environment.apiUrl}/video-calls/start`,
        {},
      ),
    );
    return {
      token: response.token,
      roomName: response.roomName,
      iceServers: response.iceServers,
      degraded: response.degraded ?? false,
      degradationReason: response.degradationReason,
    };
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
    const tokenResult = await this.getToken(roomName, userId);

    this.isDegraded.set(tokenResult.degraded);
    if (tokenResult.degradationReason) {
      this.degradationReason.set(tokenResult.degradationReason);
    }

    let roomOptions: RoomOptions = {};

    if (e2eeKey) {
      const keyProvider = new ExternalE2EEKeyProvider();
      this.e2eeWorker = new Worker(
        new URL('./livekit-e2ee.worker', import.meta.url),
        {
          type: 'module',
        },
      );
      roomOptions = {
        e2ee: {
          keyProvider,
          worker: this.e2eeWorker,
        },
      };
      await keyProvider.setKey(e2eeKey);
    }

    const room = this.createRoom(roomOptions);
    this.room = room;

    const iceServersToUse = tokenResult.iceServers && tokenResult.iceServers.length > 0
      ? tokenResult.iceServers
      : [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: environment.turnServerUrl,
            username: environment.turnUsername,
            credential: environment.turnPassword,
          },
        ];

    // Connect with retry for transient network failures
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < MAX_ROOM_CONNECT_RETRIES; attempt++) {
      try {
        await room.connect(this.getLiveKitUrl(), tokenResult.token, {
          rtcConfig: {
            iceServers: iceServersToUse,
          },
        });
        this.livekitConnected.set(true);
        return room;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_ROOM_CONNECT_RETRIES - 1) {
          const delay = ROOM_CONNECT_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All connection attempts failed - set degraded state
    this.isDegraded.set(true);
    this.degradationReason.set(
      `LiveKit connection failed after ${MAX_ROOM_CONNECT_RETRIES} attempts: ${lastError?.message ?? 'unknown error'}`,
    );
    this.livekitConnected.set(false);

    throw lastError ?? new Error('Failed to connect to LiveKit room');
  }

  async publishTracks(): Promise<{
    audioTrack: LocalTrack | null;
    videoTrack: LocalTrack | null;
  }> {
    if (!this.room) {
      return { audioTrack: null, videoTrack: null };
    }
    await this.room.localParticipant.setMicrophoneEnabled(true);
    const pub = this.room.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    );
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
    this.livekitConnected.set(false);
    this.isDegraded.set(false);
    this.degradationReason.set(null);
    if (this.e2eeWorker) {
      this.e2eeWorker.terminate();
      this.e2eeWorker = null;
    }
  }
}
