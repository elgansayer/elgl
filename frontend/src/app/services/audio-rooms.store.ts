import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Room, RoomEvent, RemoteAudioTrack, RemoteParticipant } from 'livekit-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';

export interface AudioRoomRecord {
  id: string;
  room_name: string;
  title: string;
  target_language: string;
  host_id: string;
  is_active: boolean;
  speakers: string[];
  raised_hands: string[];
  listeners_count: number;
  recording_url?: string | null;
  created_at: string;
  host?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}

export interface CaptionRecord {
  id: string;
  room_id: string;
  speaker_id: string;
  speaker_name?: string;
  text_content: string;
  created_at: string;
}

export interface RoomChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  text_content: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class AudioRoomsStore {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private centrifugeService = inject(CentrifugeService);
  private baseUrl = `${environment.apiUrl}/audio-rooms`;

  readonly activeRooms = signal<AudioRoomRecord[]>([]);
  readonly currentRoom = signal<AudioRoomRecord | null>(null);
  readonly isSpeaker = signal<boolean>(false);
  readonly isConnectedToLiveKit = signal<boolean>(false);
  readonly isRecording = signal<boolean>(false);
  readonly captions = signal<CaptionRecord[]>([]);
  readonly roomMessages = signal<RoomChatMessage[]>([]);
  readonly isLoading = signal<boolean>(false);

  private livekitRoom: Room | null = null;
  private roomSubscription: any = null;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`
    };
  }

  async loadActiveRooms(): Promise<void> {
    this.isLoading.set(true);
    try {
      const list = await firstValueFrom(
        this.http.get<AudioRoomRecord[]>(`${this.baseUrl}/list`, { headers: this.getHeaders() })
      );
      this.activeRooms.set(list);
    } catch (e) {
      console.error('Failed to load active audio rooms:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async createRoom(title: string, target_language: string): Promise<AudioRoomRecord> {
    const created = await firstValueFrom(
      this.http.post<AudioRoomRecord>(`${this.baseUrl}/create`, { title, target_language }, { headers: this.getHeaders() })
    );
    this.activeRooms.update(list => [created, ...list]);
    return created;
  }

  async joinRoom(room: AudioRoomRecord): Promise<void> {
    this.currentRoom.set(room);
    this.captions.set([]);
    this.roomMessages.set([]);

    // Fetch token
    try {
      const tokenRes = await firstValueFrom(
        this.http.post<{
          token: string;
          room_id: string;
          room_name: string;
          livekit_url: string;
          is_speaker: boolean;
        }>(`${this.baseUrl}/token`, { room_name: room.room_name }, { headers: this.getHeaders() })
      );

      this.isSpeaker.set(tokenRes.is_speaker);

      // Connect to LiveKit SFU (or mock fallback if local dev)
      if (typeof window !== 'undefined' && !tokenRes.livekit_url.includes('mock')) {
        try {
          this.livekitRoom = new Room();
          await this.livekitRoom.connect(tokenRes.livekit_url, tokenRes.token);
          this.isConnectedToLiveKit.set(true);

          if (tokenRes.is_speaker) {
            await this.livekitRoom.localParticipant.setMicrophoneEnabled(true);
          }
        } catch (lkError) {
          console.warn('LiveKit SFU connection error (using mock audio stage):', lkError);
          this.isConnectedToLiveKit.set(true);
        }
      } else {
        // Mock connection simulation
        this.isConnectedToLiveKit.set(true);
      }
    } catch (e) {
      console.error('Failed to join audio room:', e);
      alert('Could not join room right now.');
      return;
    }

    // Subscribe to Centrifugo room channel for raise-hands, stage approval, subtitles, and chat
    await this.centrifugeService.connect();
    if (this.roomSubscription) {
      this.centrifugeService.unsubscribe(`room_${room.id}`);
    }

    this.roomSubscription = this.centrifugeService.subscribe(`room_${room.id}`, (data: any) => {
      if (data.type === 'raise_hand') {
        this.currentRoom.update(r => {
          if (!r || r.raised_hands.includes(data.user_id)) return r;
          return { ...r, raised_hands: [...r.raised_hands, data.user_id] };
        });
      } else if (data.type === 'speaker_approved') {
        this.currentRoom.update(r => {
          if (!r) return r;
          const updatedHands = r.raised_hands.filter(id => id !== data.target_user_id);
          const updatedSpeakers = r.speakers.includes(data.target_user_id) ? r.speakers : [...r.speakers, data.target_user_id];
          return { ...r, raised_hands: updatedHands, speakers: updatedSpeakers };
        });

        // If target user is me, refresh token and enable mic
        if (data.target_user_id === this.authService.currentUser()?.id) {
          this.isSpeaker.set(true);
          if (this.livekitRoom) {
            void this.livekitRoom.localParticipant.setMicrophoneEnabled(true);
          }
          alert('🎉 Host approved your request to speak! Your microphone is now live on stage.');
        }
      } else if (data.type === 'subtitle' && data.caption) {
        this.captions.update(list => [...list.slice(-49), data.caption]);
      } else if (data.type === 'chat_message' && data.message) {
        this.roomMessages.update(list => [...list.slice(-99), data.message]);
      } else if (data.type === 'room_ended') {
        alert('This audio/video room has ended and been archived to Cloudflare R2.');
        this.leaveRoom();
      }
    });
  }

  async raiseHand(): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      const updated = await firstValueFrom(
        this.http.post<AudioRoomRecord>(`${this.baseUrl}/raise-hand`, { room_id: room.id }, { headers: this.getHeaders() })
      );
      this.currentRoom.set(updated);
      alert('✋ Hand raised! The host has been notified of your request to speak on stage.');
    } catch (e) {
      console.error('Raise hand error:', e);
    }
  }

  async approveSpeaker(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      const updated = await firstValueFrom(
        this.http.post<AudioRoomRecord>(`${this.baseUrl}/approve-speaker`, {
          room_id: room.id,
          target_user_id: targetUserId
        }, { headers: this.getHeaders() })
      );
      this.currentRoom.set(updated);
    } catch (e) {
      console.error('Approve speaker error:', e);
    }
  }

  async sendCaption(text: string): Promise<void> {
    const room = this.currentRoom();
    if (!room || !text.trim()) return;
    try {
      await firstValueFrom(
        this.http.post<CaptionRecord>(`${this.baseUrl}/captions`, {
          room_id: room.id,
          text_content: text.trim()
        }, { headers: this.getHeaders() })
      );
    } catch (e) {
      console.error('Send caption error:', e);
    }
  }

  async sendRoomChatMessage(text: string): Promise<void> {
    const room = this.currentRoom();
    if (!room || !text.trim()) return;
    const user = this.authService.currentUser();
    const msg: RoomChatMessage = {
      id: `rc_${Date.now()}_${Math.random()}`,
      sender_id: user?.id || 'anon',
      sender_name: user?.email ? user.email.split('@')[0] : 'Language Partner',
      text_content: text.trim(),
      created_at: new Date().toISOString()
    };
    // Publish directly via Centrifugo for instant room sync
    await this.centrifugeService.publish(`room_${room.id}`, {
      type: 'chat_message',
      message: msg
    });
  }

  async archiveRoom(recordingUrl?: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      await firstValueFrom(
        this.http.post<AudioRoomRecord>(`${this.baseUrl}/archive`, {
          room_id: room.id,
          recording_url: recordingUrl
        }, { headers: this.getHeaders() })
      );
      this.leaveRoom();
    } catch (e) {
      console.error('Archive room error:', e);
    }
  }

  leaveRoom(): void {
    if (this.livekitRoom) {
      this.livekitRoom.disconnect();
      this.livekitRoom = null;
    }
    if (this.roomSubscription && this.currentRoom()) {
      this.centrifugeService.unsubscribe(`room_${this.currentRoom()!.id}`);
      this.roomSubscription = null;
    }
    this.isConnectedToLiveKit.set(false);
    this.currentRoom.set(null);
    this.isSpeaker.set(false);
  }
}
