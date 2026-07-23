import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatService, ChatMessage, ChatRoom } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ActiveCallComponent } from '../active-call/active-call.component';

export interface IncomingCall {
  callerId: string;
  callerName: string;
  roomName: string;
  isVideo: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, ActiveCallComponent, DatePipe],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy {
  private centrifugeService = inject(CentrifugeService);
  private chatService = inject(ChatService);
  private authService = inject(AuthService);

  readonly rooms = signal<ChatRoom[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly selectedRoomId = signal<string | null>(null);
  readonly incomingCall = signal<IncomingCall | null>(null);
  readonly isCallActive = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.loadRooms();
    await this.connectCentrifugo();
    this.subscribeToCallInvites();
  }

  ngOnDestroy(): void {
    this.centrifugeService.disconnect();
  }

  private async loadRooms(): Promise<void> {
    try {
      const rooms = await this.chatService.getRooms();
      this.rooms.set(rooms);
    } catch (e) {
      console.error('Failed to load rooms', e);
    }
  }

  private async connectCentrifugo(): Promise<void> {
    try {
      await this.centrifugeService.connect();
    } catch (e) {
      console.error('Failed to connect Centrifugo', e);
    }
  }

  private subscribeToCallInvites(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;
    const channel = `user_${currentUser.id}`;
    this.centrifugeService.subscribe(channel, (data: unknown) => {
      const payload = data as { type: string; callerId: string; callerName: string; roomName: string; isVideo: boolean };
      if (payload.type === 'call_invite') {
        this.incomingCall.set({
          callerId: payload.callerId,
          callerName: payload.callerName,
          roomName: payload.roomName,
          isVideo: payload.isVideo
        });
      }
    });
  }

  selectRoom(roomId: string): void {
    this.selectedRoomId.set(roomId);
    this.loadMessages(roomId);
  }

  private async loadMessages(roomId: string): Promise<void> {
    try {
      const msgs = await this.chatService.getMessages(roomId);
      this.messages.set(msgs);
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  }

  acceptCall(): void {
    this.isCallActive.set(true);
    this.incomingCall.set(null);
  }

  declineCall(): void {
    this.incomingCall.set(null);
  }

  endCall(): void {
    this.isCallActive.set(false);
  }
}
