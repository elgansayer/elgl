import { showToast } from './toast.service';
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  createLocalVideoTrack,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { I18nService } from './i18n.service';
import { EconomyStore } from './economy.store';
import { AudioRoomDegradationService } from './audio-room-degradation.service';

export interface AudioRoomRecord {
  id: string;
  room_name: string;
  title: string;
  target_language: string;
  language_pair?: string;
  topic_tag?: string;
  host_id: string;
  co_host_id?: string | null;
  is_video_stream?: boolean;
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
  is_private?: boolean;
  invited_user_ids?: string[];
  party_type?: string;
}

export interface PrivatePartyCreatePayload {
  title: string;
  languagePair: string;
  topicTag: string;
  isVideoStream: boolean;
  invitedUserIds: string[];
}

export interface StageParticipant {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  isSpeaking: boolean;
  isMuted: boolean;
  isHost: boolean;
  isCoHost: boolean;
}

export interface StageInfo {
  room_id: string;
  room_name: string;
  host: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  co_host_id: string | null;
  speakers: Array<{
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  }>;
  raised_hands: string[];
  listeners_count: number;
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
  providedIn: 'root',
})
export class AudioRoomsStore {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private centrifugeService = inject(CentrifugeService);
  private i18n = inject(I18nService);
  private economyStore = inject(EconomyStore);
  private degradationService = inject(AudioRoomDegradationService);
  private baseUrl = `${environment.apiUrl}/audio-rooms`;

  readonly activeRooms = signal<AudioRoomRecord[]>([]);
  readonly roomsByLanguage = signal<
    Array<{
      language_pair: string;
      count: number;
      rooms: AudioRoomRecord[];
    }>
  >([]);
  readonly currentRoom = signal<AudioRoomRecord | null>(null);
  readonly isSpeaker = signal<boolean>(false);
  readonly isConnectedToLiveKit = signal<boolean>(false);
  readonly isRecording = signal<boolean>(false);
  readonly captions = signal<CaptionRecord[]>([]);
  readonly roomMessages = signal<RoomChatMessage[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly selectedLanguageGroup = signal<string | null>(null);
  readonly stageInfo = signal<StageInfo | null>(null);
  readonly stageParticipants = signal<StageParticipant[]>([]);
  readonly audienceCount = signal<number>(0);
  readonly privateRooms = signal<AudioRoomRecord[]>([]);
  readonly isLoadingPrivate = signal<boolean>(false);

  // Degradation-aware state - reactive bindings to degradation service
  readonly isLiveKitDegraded = this.degradationService.isLiveKitDegraded;
  readonly isCentrifugoDegraded = this.degradationService.isCentrifugoDegraded;
  readonly isSupabaseDegraded = this.degradationService.isSupabaseDegraded;
  readonly isFullyOperational = this.degradationService.isFullyOperational;
  readonly degradationSummary = this.degradationService.degradationSummary;

  readonly isOperatingInDegradedMode = computed(() => {
    return !this.degradationService.isFullyOperational() && this.isConnectedToLiveKit();
  });

  // Split-screen co-host video state
  readonly localVideoTrack = signal<LocalVideoTrack | null>(null);
  private readonly remoteVideoTracksByIdentity = signal<Map<string, RemoteVideoTrack>>(new Map());

  readonly hostVideoTrack = computed<RemoteVideoTrack | null>(() => {
    const room = this.currentRoom();
    if (!room) return null;
    if (this.authService.currentUser()?.id === room.host_id) {
      // local track may be a LocalVideoTrack; doesn't fit the RemoteVideoTrack type
      return null;
    }
    return this.findRemoteVideoTrack(room.host_id);
  });

  readonly coHostVideoTrack = computed<RemoteVideoTrack | null>(() => {
    const room = this.currentRoom();
    if (!room || !room.co_host_id) return null;
    if (this.authService.currentUser()?.id === room.co_host_id) {
      return null;
    }
    return this.findRemoteVideoTrack(room.co_host_id);
  });

  private livekitRoom: Room | null = null;
  private roomSubscription: unknown = null;
  private onTrackSubscribedBound: ((
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => void) | null = null;
  private onTrackUnsubscribedBound: ((
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => void) | null = null;

  /**
   * Type guard that narrows the raw Centrifugo payload into the expected shape.
   * This avoids production `as` type assertions.
   */
  private isHostTipPayload(data: unknown): data is {
    tip_id?: string;
    amount_coins?: number;
    sender_user_id?: string;
    sender_name?: string;
    receiver_user_id?: string;
  } {
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  }

  private isRoomEvent(data: unknown): data is {
    type?: string;
    user_id?: string;
    target_user_id?: string;
    caption?: CaptionRecord;
    message?: RoomChatMessage;
    animation_url?: string;
    sender_name?: string;
    receiver_name?: string;
    coin_value?: number;
    icon?: string;
    gift_name?: string;
    animation_type?: string;
    tip?: unknown;
    gift_id?: string;
    previous_co_host_id?: string | null;
  } {
    return typeof data === 'object' && data !== null;
  }

  private findRemoteVideoTrack(userId: string): RemoteVideoTrack | null {
    const suffix = `_${userId.slice(0, 6)}`;
    for (const [identity, track] of this.remoteVideoTracksByIdentity()) {
      if (identity === userId || identity.endsWith(suffix)) return track;
    }
    return null;
  }

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async loadActiveRooms(): Promise<void> {
    this.isLoading.set(true);
    try {
      const list = await firstValueFrom(
        this.http.get<AudioRoomRecord[]>(`${this.baseUrl}/list`, { headers: this.getHeaders() }),
      );
      this.activeRooms.set(list);
    } catch (e) {
      console.error('Failed to load active audio rooms:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadRoomsByLanguage(): Promise<void> {
    this.isLoading.set(true);
    try {
      const groups = await firstValueFrom(
        this.http.get<Array<{ language_pair: string; count: number; rooms: AudioRoomRecord[] }>>(
          `${this.baseUrl}/by-language`,
          { headers: this.getHeaders() },
        ),
      );
      this.roomsByLanguage.set(groups);
    } catch (e) {
      console.error('Failed to load rooms by language:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async createRoom(
    title: string,
    languagePair: string,
    topicTag: string,
    isVideoStream = false,
  ): Promise<AudioRoomRecord> {
    const created = await firstValueFrom(
      this.http.post<AudioRoomRecord>(
        `${this.baseUrl}/create`,
        {
          title,
          target_language: languagePair,
          language_pair: languagePair,
          topic_tag: topicTag,
          is_video_stream: isVideoStream,
        },
        { headers: this.getHeaders() },
      ),
    );
    this.activeRooms.update((list) => [created, ...list]);
    return created;
  }

  async createPrivateParty(payload: PrivatePartyCreatePayload): Promise<AudioRoomRecord> {
    const created = await firstValueFrom(
      this.http.post<AudioRoomRecord>(
        `${this.baseUrl}/private`,
        {
          title: payload.title,
          target_language: payload.languagePair,
          language_pair: payload.languagePair,
          topic_tag: payload.topicTag,
          is_video_stream: payload.isVideoStream,
          invited_user_ids: payload.invitedUserIds,
        },
        { headers: this.getHeaders() },
      ),
    );
    this.privateRooms.update((list) => [created, ...list]);
    this.activeRooms.update((list) => [created, ...list]);
    return created;
  }

  async loadPrivateRooms(): Promise<void> {
    this.isLoadingPrivate.set(true);
    try {
      const list = await firstValueFrom(
        this.http.get<AudioRoomRecord[]>(`${this.baseUrl}/private`, { headers: this.getHeaders() }),
      );
      this.privateRooms.set(list);
    } catch (e) {
      console.error('Failed to load private rooms:', e);
    } finally {
      this.isLoadingPrivate.set(false);
    }
  }

  async joinRoom(room: AudioRoomRecord): Promise<void> {
    this.currentRoom.set(room);
    this.captions.set([]);
    this.roomMessages.set([]);

    // Start monitoring service health for degradation indicators
    this.degradationService.startMonitoring();

    // Load stage info for full speaker/listener details
    void this.fetchStage(room.id);

    // Fetch token
    try {
      const tokenRes = await firstValueFrom(
        this.http.post<{
          token: string;
          room_id: string;
          room_name: string;
          livekit_url: string;
          is_speaker: boolean;
        }>(`${this.baseUrl}/token`, { room_name: room.room_name }, { headers: this.getHeaders() }),
      );

      this.isSpeaker.set(tokenRes.is_speaker);

      // Connect to LiveKit SFU (or mock fallback if local dev)
      if (typeof window !== 'undefined' && !tokenRes.livekit_url.includes('mock')) {
        try {
          this.livekitRoom = new Room();
          this.onTrackSubscribedBound = this.onTrackSubscribed.bind(this);
          this.onTrackUnsubscribedBound = this.onTrackUnsubscribed.bind(this);
          this.livekitRoom
            .on(RoomEvent.TrackSubscribed, this.onTrackSubscribedBound)
            .on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribedBound);
          await this.livekitRoom.connect(tokenRes.livekit_url, tokenRes.token);
          this.isConnectedToLiveKit.set(true);

          if (tokenRes.is_speaker) {
            await this.livekitRoom.localParticipant.setMicrophoneEnabled(true);
          }

          const userId = this.authService.currentUser()?.id;
          if (room.is_video_stream && (userId === room.host_id || userId === room.co_host_id)) {
            await this.publishLocalCamera();
          }
        } catch (lkError) {
          console.warn('LiveKit SFU connection error (voice-only fallback active):', lkError);
          // Degraded mode: connected but without real-time audio
          // Show a non-blocking toast so the user knows audio/video features are limited
          this.isConnectedToLiveKit.set(true);
          void this.degradationService.refreshHealth();
          showToast(this.i18n.translate('audioRoom.degradedAudioToast'));
        }
      } else {
        // Mock connection simulation
        this.isConnectedToLiveKit.set(true);
      }
    } catch (e) {
      console.error('Failed to join audio room:', e);
      showToast(this.i18n.translate('audioRoom.joinError'));
      return;
    }

    // Subscribe to Centrifugo room channel for raise-hands, stage approval, subtitles, and chat
    await this.centrifugeService.connect();
    if (this.roomSubscription) {
      this.centrifugeService.unsubscribe(`room_${room.id}`);
    }

    this.roomSubscription = this.centrifugeService.subscribe(`room_${room.id}`, (data: unknown) => {
      if (!this.isRoomEvent(data)) return;
      const p = data;

      if (p.type === 'raise_hand' && p.user_id) {
        this.currentRoom.update((r) => {
          if (!r || r.raised_hands.includes(p.user_id!)) return r;
          return { ...r, raised_hands: [...r.raised_hands, p.user_id!] };
        });
      } else if (p.type === 'speaker_approved' && p.target_user_id) {
        this.currentRoom.update((r) => {
          if (!r) return r;
          const updatedHands = r.raised_hands.filter((id) => id !== p.target_user_id);
          const updatedSpeakers = r.speakers.includes(p.target_user_id!)
            ? r.speakers
            : [...r.speakers, p.target_user_id!];
          return { ...r, raised_hands: updatedHands, speakers: updatedSpeakers };
        });

        // If target user is me, refresh token and enable mic
        if (p.target_user_id === this.authService.currentUser()?.id) {
          this.isSpeaker.set(true);
          if (this.livekitRoom) {
            void this.livekitRoom.localParticipant.setMicrophoneEnabled(true);
          }
          showToast(this.i18n.translate('audioRoom.speakerApprovedToast'));
        }
      } else if (p.type === 'speaker_demoted' && p.target_user_id) {
        this.currentRoom.update((r) => {
          if (!r) return r;
          return { ...r, speakers: r.speakers.filter((id) => id !== p.target_user_id) };
        });

        // If target user is me, drop publish permission and mute the microphone
        if (p.target_user_id === this.authService.currentUser()?.id) {
          this.isSpeaker.set(false);
          if (this.livekitRoom) {
            void this.livekitRoom.localParticipant.setMicrophoneEnabled(false);
          }
          showToast(this.i18n.translate('audioRoom.speakerDemotedToast'));
        }
      } else if (p.type === 'co_host_changed' && p.target_user_id) {
        // Single atomic event: previous co-host (if any) is removed and new co-host is invited.
        // Eliminates the race condition where separate co_host_removed / co_host_invited
        // Centrifugo events could arrive out of order.
        const currentUserId = this.authService.currentUser()?.id;
        const previousCoHostId =
          typeof p.previous_co_host_id === 'string' ? p.previous_co_host_id : null;

        this.currentRoom.update((r) => {
          if (!r) return r;
          let speakers = r.speakers;
          if (previousCoHostId) {
            speakers = speakers.filter((id) => id !== previousCoHostId);
          }
          if (!speakers.includes(p.target_user_id!)) {
            speakers = [...speakers, p.target_user_id!];
          }
          const updatedHands = r.raised_hands.filter((id) => id !== p.target_user_id);
          return {
            ...r,
            co_host_id: p.target_user_id,
            raised_hands: updatedHands,
            speakers,
          };
        });

        // If I was the previous co-host, unpublish camera
        if (previousCoHostId && previousCoHostId === currentUserId) {
          this.isSpeaker.set(false);
          this.unpublishLocalCamera();
          showToast(this.i18n.translate('audioRoom.coHostRemovedToast'));
        }
        // If I am the new co-host, publish camera
        if (p.target_user_id === currentUserId) {
          this.isSpeaker.set(true);
          void this.publishLocalCamera();
          showToast(this.i18n.translate('audioRoom.coHostPromotedToast'));
        }
      } else if (p.type === 'co_host_invited' && p.target_user_id) {
        this.currentRoom.update((r) => {
          if (!r) return r;
          const updatedHands = r.raised_hands.filter((id) => id !== p.target_user_id);
          const updatedSpeakers = r.speakers.includes(p.target_user_id!)
            ? r.speakers
            : [...r.speakers, p.target_user_id!];
          return {
            ...r,
            co_host_id: p.target_user_id,
            raised_hands: updatedHands,
            speakers: updatedSpeakers,
          };
        });

        // If target user is me, publish my camera and join the split-screen layout
        if (p.target_user_id === this.authService.currentUser()?.id) {
          this.isSpeaker.set(true);
          void this.publishLocalCamera();
          showToast(this.i18n.translate('audioRoom.coHostPromotedToast'));
        }
      } else if (p.type === 'co_host_removed' && p.target_user_id) {
        this.currentRoom.update((r) => {
          if (!r) return r;
          // Only clear co_host_id if it still points at the removed user: an out-of-order
          // co_host_removed arriving after a newer co_host_invited must not wipe out the
          // just-assigned co-host.
          const nextCoHostId = r.co_host_id === p.target_user_id ? null : r.co_host_id;
          return {
            ...r,
            co_host_id: nextCoHostId,
            speakers: r.speakers.filter((id) => id !== p.target_user_id),
          };
        });

        // If target user is me, stop publishing camera and leave the split-screen layout
        if (p.target_user_id === this.authService.currentUser()?.id) {
          this.isSpeaker.set(false);
          this.unpublishLocalCamera();
          showToast(this.i18n.translate('audioRoom.coHostRemovedToast'));
        }
      } else if (p.type === 'force_mute' && p.target_user_id) {
        this.stageParticipants.update((list) =>
          list.map((sp) => (sp.user_id === p.target_user_id ? { ...sp, isMuted: true } : sp)),
        );

        // If target user is me, mute my local microphone
        if (p.target_user_id === this.authService.currentUser()?.id) {
          if (this.livekitRoom) {
            void this.livekitRoom.localParticipant.setMicrophoneEnabled(false);
          }
          showToast(this.i18n.translate('audioRoom.micForceMutedToast'));
        }
      } else if (p.type === 'force_unmute' && p.target_user_id) {
        this.stageParticipants.update((list) =>
          list.map((sp) => (sp.user_id === p.target_user_id ? { ...sp, isMuted: false } : sp)),
        );

        // If target user is me, unmute my local microphone
        if (p.target_user_id === this.authService.currentUser()?.id) {
          if (this.livekitRoom) {
            void this.livekitRoom.localParticipant.setMicrophoneEnabled(true);
          }
          showToast(this.i18n.translate('audioRoom.micForceUnmutedToast'));
        }
      } else if (p.type === 'speaker_kicked' && p.target_user_id) {
        // Remove kicked user from both currentRoom speakers and stageParticipants
        this.currentRoom.update((r) => {
          if (!r) return r;
          return { ...r, speakers: r.speakers.filter((id) => id !== p.target_user_id) };
        });
        this.stageParticipants.update((list) =>
          list.filter((sp) => sp.user_id !== p.target_user_id),
        );

        // If target user is me, drop publish permission, mute, and notify
        if (p.target_user_id === this.authService.currentUser()?.id) {
          this.isSpeaker.set(false);
          if (this.livekitRoom) {
            void this.livekitRoom.localParticipant.setMicrophoneEnabled(false);
          }
          showToast(this.i18n.translate('audioRoom.speakerKickedToast'));
        }
      } else if (p.type === 'subtitle' && p.caption) {
        this.captions.update((list) => [...list.slice(-49), p.caption!]);
      } else if (p.type === 'host_tip' && p.tip && this.isHostTipPayload(p.tip)) {
        const tip = p.tip;
        // Don't replay animation for the sender -- it already fired locally in tipHost()
        if (tip.sender_user_id === this.authService.currentUser()?.id) {
          return;
        }
        const amount = tip.amount_coins ?? 0;
        this.economyStore.triggerPublicGiftAnimation({
          giftId: `tip_${tip.tip_id ?? 'unknown'}`,
          giftName: `${amount} Coins`,
          giftIcon: this.tipIconForAmount(amount),
          animationType: this.tipAnimationForAmount(amount),
          animationUrl: undefined,
          senderName: tip.sender_name ?? 'Someone',
          receiverName: 'Host',
          coinValue: amount,
        });
      } else if (p.type === 'virtual_gift' && p.icon && p.gift_name) {
        this.economyStore.triggerPublicGiftAnimation({
          giftId: typeof p.gift_id === 'string' ? p.gift_id : 'unknown',
          giftName: typeof p.gift_name === 'string' ? p.gift_name : 'Gift',
          giftIcon: typeof p.icon === 'string' ? p.icon : '🎁',
          animationType: typeof p.animation_type === 'string' ? p.animation_type : 'float',
          animationUrl: typeof p.animation_url === 'string' ? p.animation_url : undefined,
          senderName: typeof p.sender_name === 'string' ? p.sender_name : 'Someone',
          receiverName: typeof p.receiver_name === 'string' ? p.receiver_name : 'Host',
          coinValue: typeof p.coin_value === 'number' ? p.coin_value : 0,
        });
      } else if (p.type === 'chat_message' && p.message) {
        this.roomMessages.update((list) => [...list.slice(-99), p.message!]);
      } else if (p.type === 'hand_dismissed' && p.target_user_id) {
        this.currentRoom.update((r) => {
          if (!r) return r;
          return {
            ...r,
            raised_hands: r.raised_hands.filter((id: string) => id !== p.target_user_id),
          };
        });
      } else if (p.type === 'room_ended') {
        showToast(this.i18n.translate('audioRoom.roomEndedToast'));
        this.leaveRoom();
      }
    });
  }

  private async publishLocalCamera(): Promise<void> {
    if (!this.livekitRoom || this.localVideoTrack()) return;
    try {
      const track = await createLocalVideoTrack();
      await this.livekitRoom.localParticipant.publishTrack(track);
      this.localVideoTrack.set(track);
    } catch (e) {
      console.warn('Could not publish local camera track:', e);
    }
  }

  private unpublishLocalCamera(): void {
    const track = this.localVideoTrack();
    if (!track) return;
    if (this.livekitRoom) {
      void this.livekitRoom.localParticipant.unpublishTrack(track);
    }
    track.stop();
    this.localVideoTrack.set(null);
  }

  private onTrackSubscribed(
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): void {
    if (track instanceof RemoteVideoTrack) {
      this.remoteVideoTracksByIdentity.update((map) => {
        const next = new Map(map);
        next.set(participant.identity, track);
        return next;
      });
    }
  }

  private onTrackUnsubscribed(
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): void {
    if (track.kind === Track.Kind.Video) {
      this.remoteVideoTracksByIdentity.update((map) => {
        const next = new Map(map);
        next.delete(participant.identity);
        return next;
      });
    }
  }

  async raiseHand(): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      const updated = await firstValueFrom(
        this.http.post<AudioRoomRecord>(
          `${this.baseUrl}/raise-hand`,
          { room_id: room.id },
          { headers: this.getHeaders() },
        ),
      );
      this.currentRoom.set(updated);
      showToast(this.i18n.translate('audioRoom.raiseHandToast'));
    } catch (e) {
      console.error('Raise hand error:', e);
    }
  }

  async approveSpeaker(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      const updated = await firstValueFrom(
        this.http.post<AudioRoomRecord>(
          `${this.baseUrl}/approve-speaker`,
          {
            room_id: room.id,
            target_user_id: targetUserId,
          },
          { headers: this.getHeaders() },
        ),
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
        this.http.post<AudioRoomRecord>(
          `${this.baseUrl}/demote-speaker`,
          {
            room_id: room.id,
            target_user_id: targetUserId,
          },
          { headers: this.getHeaders() },
        ),
      );
      this.currentRoom.set(updated);
    } catch (e) {
      console.error('Demote speaker error:', e);
    }
  }

  async dismissRaisedHand(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    this.currentRoom.update((r) => {
      if (!r) return r;
      return { ...r, raised_hands: r.raised_hands.filter((id: string) => id !== targetUserId) };
    });
    try {
      await firstValueFrom(
        this.http.post<void>(
          `${this.baseUrl}/dismiss-raised-hand`,
          { room_id: room.id, target_user_id: targetUserId },
          { headers: this.getHeaders() },
        ),
      );
    } catch {
      this.currentRoom.update((r) => {
        if (!r) return r;
        return { ...r, raised_hands: [...r.raised_hands, targetUserId] };
      });
    }
  }

  async muteSpeaker(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      await firstValueFrom(
        this.http.post<AudioRoomRecord>(
          `${this.baseUrl}/mute-speaker`,
          {
            room_id: room.id,
            target_user_id: targetUserId,
          },
          { headers: this.getHeaders() },
        ),
      );
    } catch (e) {
      console.error('Mute speaker error:', e);
    }
  }

  async unmuteSpeaker(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      await firstValueFrom(
        this.http.post<AudioRoomRecord>(
          `${this.baseUrl}/unmute-speaker`,
          {
            room_id: room.id,
            target_user_id: targetUserId,
          },
          { headers: this.getHeaders() },
        ),
      );
    } catch (e) {
      console.error('Unmute speaker error:', e);
    }
  }

  async kickSpeaker(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      await firstValueFrom(
        this.http.post<AudioRoomRecord>(
          `${this.baseUrl}/kick-speaker`,
          {
            room_id: room.id,
            target_user_id: targetUserId,
          },
          { headers: this.getHeaders() },
        ),
      );
    } catch (e) {
      console.error('Kick speaker error:', e);
    }
  }

  async inviteCoHost(targetUserId: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      const updated = await firstValueFrom(
        this.http.post<AudioRoomRecord>(
          `${this.baseUrl}/invite-co-host`,
          {
            room_id: room.id,
            target_user_id: targetUserId,
          },
          { headers: this.getHeaders() },
        ),
      );
      this.currentRoom.set(updated);
    } catch (e) {
      console.error('Invite co-host error:', e);
      showToast(this.i18n.translate('audioRoom.inviteCoHostError'));
    }
  }

  async removeCoHost(): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      const updated = await firstValueFrom(
        this.http.post<AudioRoomRecord>(
          `${this.baseUrl}/remove-co-host`,
          {
            room_id: room.id,
          },
          { headers: this.getHeaders() },
        ),
      );
      this.currentRoom.set(updated);
    } catch (e) {
      console.error('Remove co-host error:', e);
      showToast(this.i18n.translate('audioRoom.removeCoHostError'));
    }
  }

  async sendCaption(text: string): Promise<void> {
    const room = this.currentRoom();
    if (!room || !text.trim()) return;
    try {
      await firstValueFrom(
        this.http.post<CaptionRecord>(
          `${this.baseUrl}/captions`,
          {
            room_id: room.id,
            text_content: text.trim(),
          },
          { headers: this.getHeaders() },
        ),
      );
    } catch (e) {
      console.error('Send caption error:', e);
    }
  }

  async broadcastAICaption(text: string): Promise<void> {
    const room = this.currentRoom();
    if (!room || !text.trim()) return;
    try {
      await firstValueFrom(
        this.http.post<void>(
          `${this.baseUrl}/ai-captions`,
          {
            room_id: room.id,
            text_content: text.trim(),
          },
          { headers: this.getHeaders() },
        ),
      );
    } catch (e) {
      console.error('Broadcast AI caption error:', e);
    }
  }

  async tipHost(roomId: string, amountCoins: number): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{
          tip_id: string;
          amount_coins: number;
          receiver_id: string;
          receiver_new_balance: number;
        }>(
          `${this.baseUrl}/${roomId}/tip`,
          { room_id: roomId, amount_coins: amountCoins },
          { headers: this.getHeaders() },
        ),
      );
      this.economyStore.coinsBalance.update((bal) => bal - amountCoins);

      const user = this.authService.currentUser();
      const senderName = user?.display_name ?? 'Someone';
      const animationType = this.tipAnimationForAmount(amountCoins);

      // Fire full-screen SVG animation immediately for the sender
      this.economyStore.triggerPublicGiftAnimation({
        giftId: `tip_${res.tip_id}`,
        giftName: `${amountCoins} Coins`,
        giftIcon: this.tipIconForAmount(amountCoins),
        animationType,
        animationUrl: undefined,
        senderName,
        receiverName: 'Host',
        coinValue: amountCoins,
      });

      showToast(
        this.i18n.translate('audioRoom.tipSentToast', {
          amount: amountCoins,
        }),
      );
      return true;
    } catch (e: unknown) {
      console.error('Tip host error:', e);
      const message = e instanceof Error ? e.message : String(e);
      showToast(message || this.i18n.translate('audioRoom.tipError'));
      return false;
    }
  }

  private tipAnimationForAmount(amount: number): string {
    if (amount >= 500) return 'premium';
    if (amount >= 100) return 'confetti';
    if (amount >= 50) return 'hearts';
    return 'sparkle';
  }

  private tipIconForAmount(amount: number): string {
    if (amount >= 500) return '💎';
    if (amount >= 100) return '🎁';
    if (amount >= 50) return '💝';
    return '🪙';
  }

  async sendRoomChatMessage(text: string): Promise<void> {
    const room = this.currentRoom();
    if (!room || !text.trim()) return;
    const user = this.authService.currentUser();
    const msg: RoomChatMessage = {
      id: `rc_${Date.now()}_${crypto.randomUUID()}`,
      sender_id: user?.id || 'anon',
      sender_name: user?.email ? user.email.split('@')[0] : 'Language Partner',
      text_content: text.trim(),
      created_at: new Date().toISOString(),
    };
    // Publish directly via Centrifugo for instant room sync
    await this.centrifugeService.publish(`room_${room.id}`, {
      type: 'chat_message',
      message: msg,
    });
  }

  async archiveRoom(recordingUrl?: string): Promise<void> {
    const room = this.currentRoom();
    if (!room) return;
    try {
      await firstValueFrom(
        this.http.post<AudioRoomRecord>(
          `${this.baseUrl}/archive`,
          {
            room_id: room.id,
            recording_url: recordingUrl,
          },
          { headers: this.getHeaders() },
        ),
      );
      this.leaveRoom();
    } catch (e) {
      console.error('Archive room error:', e);
    }
  }

  private async fetchStage(roomId: string): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.http.get<StageInfo>(`${this.baseUrl}/${roomId}/stage`, { headers: this.getHeaders() }),
      );
      this.stageInfo.set(result);
      this.stageParticipants.set(
        result.speakers.map((s) => ({
          user_id: s.user_id,
          display_name: s.display_name,
          avatar_url: s.avatar_url,
          isSpeaking: false,
          isMuted: false,
          isHost: s.user_id === (result.host?.id ?? ''),
          isCoHost: s.user_id === (result.co_host_id ?? ''),
        })),
      );
      this.audienceCount.set(result.listeners_count);
    } catch {
      // Non-critical, stage info is best-effort
    }
  }

  leaveRoom(): void {
    // Stop health monitoring when leaving the audio room context
    this.degradationService.stopMonitoring();

    if (this.livekitRoom) {
      if (this.onTrackSubscribedBound) {
        this.livekitRoom.off(RoomEvent.TrackSubscribed, this.onTrackSubscribedBound);
        this.onTrackSubscribedBound = null;
      }
      if (this.onTrackUnsubscribedBound) {
        this.livekitRoom.off(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribedBound);
        this.onTrackUnsubscribedBound = null;
      }
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
    this.stageInfo.set(null);
    this.stageParticipants.set([]);
    this.audienceCount.set(0);
    this.unpublishLocalCamera();
    this.remoteVideoTracksByIdentity.set(new Map());
  }
}
