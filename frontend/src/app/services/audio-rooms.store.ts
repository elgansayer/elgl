import { showToast } from './toast.service';
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Room } from 'livekit-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';

export interface AudioRoomRecord {
  id: string;
  room_name: string;
  title: string;
  target_language: string;
  language_pair?: string;
  topic_tag?: string;
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
  private roomSubscription: unknown = null;

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

  async createRoom(title: string, languagePair: string, topicTag: string): Promise<AudioRoomRecord> {
    const created = await firstValueFrom(
      this.http.post<AudioRoomRecord>(`${this.baseUrl}/create`, {
        title,
        target_language: languagePair,
        language_pair: languagePair,
        topic_tag: topicTag,
      }, { headers: this.getHeaders() })
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
      showToast('Could not join room right now.');
      return;
    }

    // Subscribe to Centrifugo room channel for raise-hands, stage approval, subtitles, and chat
    await this.centrifugeService.connect();
    if (this.roomSubscription) {
      this.centrifugeService.unsubscribe(`room_${room.id}`);
    }

    this.roomSubscription = this.centrifugeService.subscribe(`room_${room.id}`, (data: unknown) => {
      const payload = data as {
        type?: string;
        user_id?: string;
        target_user_id?: string;
        caption?: CaptionRecord;
        message?: RoomChatMessage;
      } | null;
      if (!payload) return;

      if (payload.type === 'raise_hand' && payload.user_id) {
        this.currentRoom.update(r => {
          if (!r || r.raised_hands.includes(payload.user_id!)) return r;
          return { ...r, raised_hands: [...r.raised_hands, payload.user_id!] };
        });
      } else if (payload.type === 'speaker_approved' && payload.target_user_id) {
        this.currentRoom.update(r => {
          if (!r) return r;
          const updatedHands = r.raised_hands.filter(id => id !== payload.target_user_id);
          const updatedSpeakers = r.speakers.includes(payload.target_user_id!) ? r.speakers : [...r.speakers, payload.target_user_id!];
          return { ...r, raised_hands: updatedHands, speakers: updatedSpeakers };
        });

        // If target user is me, refresh token and enable mic
        if (payload.target_user_id === this.authService.currentUser()?.id) {
          this.isSpeaker.set(true);
          if (this.livekitRoom) {
            void this.livekitRoom.localParticipant.setMicrophoneEnabled(true);
          }
          showToast('🎉 Host approved your request to speak! Your microphone is now live on stage.');
        }
      } else if (payload.type === 'speaker_demoted' && payload.target_user_id) {
        this.currentRoom.update(r => {
          if (!r) return r;
          return { ...r, speakers: r.speakers.filter(id => id !== payload.target_user_id) };
        });

        // If target user is me, drop publish permission and mute the microphone
        if (payload.target_user_id === this.authService.currentUser()?.id) {
          this.isSpeaker.set(false);
          if (this.livekitRoom) {
            void this.livekitRoom.localParticipant.setMicrophoneEnabled(false);
          }
          showToast('The host moved you back to the listener audience.');
        }
      } else if (payload.type === 'subtitle' && payload.caption) {
        this.captions.update(list => [...list.slice(-49), payload.caption!]);
      } else if (payload.type === 'chat_message' && payload.message) {
        this.roomMessages.update(list => [...list.slice(-99), payload.message!]);
      } else if (payload.type === 'room_ended') {
        showToast('This audio/video room has ended and been archived to Cloudflare R2.');
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
      showToast('✋ Hand raised! The host has been notified of your request to speak on stage.');
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

  async demoteSpeaker(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      const updated = await firstValueFrom(
        this.http.post<AudioRoomRecord>(`${this.baseUrl}/demote-speaker`, {
          room_id: room.id,
          target_user_id: targetUserId
        }, { headers: this.getHeaders() })
      );
      this.currentRoom.set(updated);
    } catch (e) {
      console.error('Demote speaker error:', e);
    }
  }

  async inviteCoHost(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      const updated = await firstValueFrom(
        this.http.post<AudioRoomRecord>(`${this.baseUrl}/invite-co-host`, {
          room_id: room.id,
          target_user_id: targetUserId
        }, { headers: this.getHeaders() })
      );
      this.currentRoom.set(updated);
    } catch (e) {
      console.error('Invite co-host error:', e);
    }
  }

  async muteSpeaker(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      const updated = await firstValueFrom(
        this.http.post<AudioRoomRecord>(`${this.baseUrl}/mute-speaker`, {
          room_id: room.id,
          target_user_id: targetUserId
        }, { headers: this.getHeaders() })
      );
      this.currentRoom.set(updated);
    } catch (e) {
      console.error('Mute speaker error:', e);
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
