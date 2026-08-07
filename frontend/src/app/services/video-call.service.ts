import { Injectable, inject, signal } from '@angular/core';
import { Room, RoomEvent, Track, RemoteParticipant, VideoPresets } from 'livekit-client';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface VideoCallState {
  roomName: string;
  remoteParticipantId: string;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
}

@Injectable({
  providedIn: 'root',
})
export class VideoCallService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private room: Room | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;

  readonly callState = signal<VideoCallState | null>(null);
  readonly localVideoTrack = signal<MediaStreamTrack | null>(null);
  readonly remoteVideoTrack = signal<MediaStreamTrack | null>(null);
  readonly remoteAudioTrack = signal<MediaStreamTrack | null>(null);
  readonly connectionError = signal<string | null>(null);

  async startCall(remoteUserId: string): Promise<void> {
    try {
      const token = this.authService.getAccessToken();
      if (!token) throw new Error('Not authenticated');

      const response = await firstValueFrom(
        this.http.post<{ token: string; roomName: string }>(
          `${environment.apiUrl}/video-calls/start`,
          { remoteUserId },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      this.setupRoomListeners();
      await this.room.connect(environment.liveKitUrl, response.token);
      await this.room.localParticipant.enableCameraAndMicrophone();

      this.callState.set({
        roomName: response.roomName,
        remoteParticipantId: remoteUserId,
        isConnected: true,
        isMuted: false,
        isVideoOff: false,
        callDuration: 0,
      });

      this.startDurationTimer();

      const localVideoPublication = this.room.localParticipant.getTrackPublication(
        Track.Source.Camera,
      );
      if (localVideoPublication?.track) {
        this.localVideoTrack.set(localVideoPublication.track.mediaStreamTrack);
      }
    } catch (error) {
      this.connectionError.set('Failed to start video call');
      console.error('Video call start error:', error);
      throw error;
    }
  }

  async acceptCall(roomName: string, token: string): Promise<void> {
    try {
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      this.setupRoomListeners();
      await this.room.connect(environment.liveKitUrl, token);
      await this.room.localParticipant.enableCameraAndMicrophone();

      this.callState.set({
        roomName,
        remoteParticipantId: '',
        isConnected: true,
        isMuted: false,
        isVideoOff: false,
        callDuration: 0,
      });

      this.startDurationTimer();

      const localVideoPublication = this.room.localParticipant.getTrackPublication(
        Track.Source.Camera,
      );
      if (localVideoPublication?.track) {
        this.localVideoTrack.set(localVideoPublication.track.mediaStreamTrack);
      }
    } catch (error) {
      this.connectionError.set('Failed to accept video call');
      console.error('Video call accept error:', error);
      throw error;
    }
  }

  async endCall(): Promise<void> {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }

    this.stopDurationTimer();

    // Stop MediaStreamTracks to free camera/mic resources
    this.localVideoTrack()?.stop();
    this.remoteVideoTrack()?.stop();
    this.remoteAudioTrack()?.stop();

    this.localVideoTrack.set(null);
    this.remoteVideoTrack.set(null);
    this.remoteAudioTrack.set(null);
    this.callState.set(null);
    this.connectionError.set(null);
  }

  async toggleMute(): Promise<void> {
    if (!this.room) return;

    const currentState = this.callState();
    if (!currentState) return;

    const audioPublication = this.room.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    );
    if (audioPublication?.track) {
      if (!currentState.isMuted) {
        await audioPublication.track.mute();
      } else {
        await audioPublication.track.unmute();
      }
      this.callState.set({ ...currentState, isMuted: !currentState.isMuted });
    }
  }

  async toggleVideo(): Promise<void> {
    if (!this.room) return;

    const currentState = this.callState();
    if (!currentState) return;

    const videoPublication = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (videoPublication?.track) {
      if (!currentState.isVideoOff) {
        await videoPublication.track.mute();
      } else {
        await videoPublication.track.unmute();
      }
      this.callState.set({ ...currentState, isVideoOff: !currentState.isVideoOff });
    }
  }

  async switchCamera(): Promise<void> {
    if (!this.room) return;

    const devices = await Room.getLocalDevices('videoinput');
    if (devices.length < 2) return;

    const currentDeviceId = this.room.getActiveDevice('videoinput');
    const nextDevice = devices.find((d) => d.deviceId !== currentDeviceId) ?? devices[0];
    await this.room.switchActiveDevice('videoinput', nextDevice.deviceId);
  }

  private setupRoomListeners(): void {
    if (!this.room) return;

    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      this.handleRemoteParticipantTracks(participant);
    });

    this.room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (participant instanceof RemoteParticipant) {
        if (track.kind === 'video') {
          this.remoteVideoTrack.set(track.mediaStreamTrack);
        } else if (track.kind === 'audio') {
          this.remoteAudioTrack.set(track.mediaStreamTrack);
        }
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === 'video') {
        this.remoteVideoTrack.set(null);
      } else if (track.kind === 'audio') {
        this.remoteAudioTrack.set(null);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.endCall();
    });

    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (state === 'disconnected') {
        this.endCall();
      }
    });
  }

  private handleRemoteParticipantTracks(participant: RemoteParticipant): void {
    participant.trackPublications.forEach((publication) => {
      if (publication.track && publication.isSubscribed) {
        if (publication.kind === 'video') {
          this.remoteVideoTrack.set(publication.track.mediaStreamTrack);
        } else if (publication.kind === 'audio') {
          this.remoteAudioTrack.set(publication.track.mediaStreamTrack);
        }
      }
    });
  }

  private startDurationTimer(): void {
    this.durationInterval = setInterval(() => {
      const currentState = this.callState();
      if (currentState) {
        this.callState.set({
          ...currentState,
          callDuration: currentState.callDuration + 1,
        });
      }
    }, 1000);
  }

  private stopDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }
}
