import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { RoomChatComponent } from '../room-chat/room-chat.component';
import { VirtualGiftModalComponent } from '../virtual-gift-modal/virtual-gift-modal.component';
import { TrustSafetyModalComponent } from '../trust-safety-modal/trust-safety-modal.component';

@Component({
  selector: 'app-audio-room',
  standalone: true,
  imports: [CommonModule, FormsModule, RoomChatComponent, VirtualGiftModalComponent, TrustSafetyModalComponent],
  templateUrl: './audio-room.component.html',
  styleUrls: ['./audio-room.component.scss']
})
export class AudioRoomComponent implements OnInit {
  readonly store = inject(AudioRoomsStore);
  readonly authService = inject(AuthService);

  readonly showCreateModal = signal<boolean>(false);
  readonly showGiftModal = signal<boolean>(false);
  readonly showSafetyModal = signal<boolean>(false);
  newTitle = '';
  newTargetLanguage = 'en';

  async ngOnInit(): Promise<void> {
    await this.store.loadActiveRooms();
  }

  async createRoom(): Promise<void> {
    if (!this.newTitle.trim()) return;
    try {
      const room = await this.store.createRoom(this.newTitle.trim(), this.newTargetLanguage);
      this.showCreateModal.set(false);
      this.newTitle = '';
      await this.store.joinRoom(room);
    } catch (e) {
      console.error('Error creating live room:', e);
      alert('Failed to launch audio room.');
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

  async archive(): Promise<void> {
    if (!confirm('Are you sure you want to end this room and archive the recording to Cloudflare R2?')) return;
    await this.store.archiveRoom();
  }
}
