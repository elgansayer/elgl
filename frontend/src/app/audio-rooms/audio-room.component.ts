import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../services/translate.pipe';

export interface AudioRoomParticipant {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isSpeaking: boolean;
  isMuted: boolean;
  isHost?: boolean;
  isCoHost?: boolean;
}

@Component({
  selector: 'app-audio-room',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './audio-room.component.html',
  styleUrl: './audio-room.component.scss',
})
export class AudioRoomComponent {
  readonly host = input.required<AudioRoomParticipant>();
  readonly speakers = input<AudioRoomParticipant[]>([]);
  readonly listeners = input<AudioRoomParticipant[]>([]);
  readonly isVideoStream = input<boolean>(false);

  readonly speakerCount = computed(() => this.speakers().length);
  readonly listenerCount = computed(() => this.listeners().length);

  readonly stageParticipants = computed(() => [this.host(), ...this.speakers()]);
}
