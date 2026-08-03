import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../services/translate.pipe';

export interface RoomParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isHost?: boolean;
  isSpeaking?: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  selector: 'app-audio-room',
  templateUrl: './audio-room.component.html',
  styleUrl: './audio-room.component.scss',
})
export class AudioRoomComponent {
  readonly roomId = input<string>('');

  private readonly mockedParticipants: RoomParticipant[] = [
    { id: 'host-1', displayName: 'Host Name', avatarUrl: 'https://r2.example.com/avatars/host.png', isHost: true, isSpeaking: true },
    { id: 'speaker-1', displayName: 'Speaker A', avatarUrl: 'https://r2.example.com/avatars/speaker1.png', isSpeaking: false },
    { id: 'speaker-2', displayName: 'Speaker B', avatarUrl: 'https://r2.example.com/avatars/speaker2.png', isSpeaking: false },
    { id: 'listener-1', displayName: 'Listener 1', avatarUrl: 'https://r2.example.com/avatars/listener1.png' },
    { id: 'listener-2', displayName: 'Listener 2', avatarUrl: 'https://r2.example.com/avatars/listener2.png' },
    { id: 'listener-3', displayName: 'Listener 3', avatarUrl: 'https://r2.example.com/avatars/listener3.png' },
  ];

  readonly participants = signal<RoomParticipant[]>(this.mockedParticipants);

  readonly host = computed(() => this.participants().filter((p) => p.isHost));
  readonly speakers = computed(() =>
    this.participants().filter((p) => !p.isHost && p.isSpeaking !== undefined),
  );
  readonly listeners = computed(() =>
    this.participants().filter((p) => !p.isHost && p.isSpeaking === undefined),
  );

  leave(): void {
    // TODO: implement backend call to leave the room
  }
}
