import { showToast } from '../../services/toast.service';
import { Component, inject, signal, OnInit } from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { RoomChatComponent } from '../room-chat/room-chat.component';
import { VirtualGiftModalComponent } from '../virtual-gift-modal/virtual-gift-modal.component';
import { TrustSafetyModalComponent } from '../trust-safety-modal/trust-safety-modal.component';
import {
  VoiceroomCreateModalComponent,
  VoiceroomCreatePayload,
} from '../voiceroom-create-modal/voiceroom-create-modal.component';

@Component({
  selector: 'app-audio-room',
  imports: [
    TranslatePipe,
    RoomChatComponent,
    VirtualGiftModalComponent,
    TrustSafetyModalComponent,
    VoiceroomCreateModalComponent,
  ],
  templateUrl: './audio-room.component.html',
  styleUrls: ['./audio-room.component.scss'],
})
export class AudioRoomComponent implements OnInit {
  readonly store = inject(AudioRoomsStore);
  readonly authService = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly showCreateModal = signal<boolean>(false);
  readonly showGiftModal = signal<boolean>(false);
  readonly showSafetyModal = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.store.loadActiveRooms();
  }

  async createRoom(payload: VoiceroomCreatePayload): Promise<void> {
    try {
      const room = await this.store.createRoom(payload.title, payload.languagePair, payload.topicTag);
      this.showCreateModal.set(false);
      await this.store.joinRoom(room);
    } catch (e) {
      console.error('Error creating live room:', e);
      showToast(this.i18n.translate('audioRoom.launchError'));
    }
  }

  async join(room: AudioRoomRecord): Promise<void> {
    await this.store.joinRoom(room);
  }

  leave(): void {
    this.store.leaveRoom();
  }

  async raiseHand(): Promise<void> {
    await this.store.raiseHand();
  }

  async approve(targetUserId: string): Promise<void> {
    await this.store.approveSpeaker(targetUserId);
  }

  async demote(targetUserId: string): Promise<void> {
    await this.store.demoteSpeaker(targetUserId);
  }

  async mute(targetUserId: string): Promise<void> {
    // Ensure you add muteSpeaker(targetUserId: string) to your AudioRoomsStore
    await this.store.muteSpeaker(targetUserId);
  }

  async kick(targetUserId: string): Promise<void> {
    // Kicking off stage is functionally demoting them back to a listener
    await this.store.demoteSpeaker(targetUserId);
  }

  async archive(): Promise<void> {
    if (!confirm(this.i18n.translate('audioRoom.archiveConfirm'))) return;
    await this.store.archiveRoom();
  }
}
