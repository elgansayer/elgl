import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { CentrifugoService, RoomLiveMessage } from '../../services/centrifugo.service';

@Component({
  selector: 'app-room-chat',
  templateUrl: './room-chat.component.html',
  styleUrls: ['./room-chat.component.css'],
  imports: [TranslatePipe],
})
export class RoomChatComponent {
  readonly roomId = input.required<string>();
  readonly messages = signal<RoomLiveMessage[]>([]);
  readonly inputText = signal('');

  private readonly centrifugo = inject(CentrifugoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messagesContainer = viewChild<HTMLElement>('messagesContainer');
  private subscribedRoomId?: string;

  constructor() {
    effect(() => {
      const currentRoomId = this.roomId();
      if (this.subscribedRoomId && this.subscribedRoomId !== currentRoomId) {
        this.centrifugo.unsubscribeLiveRoom(this.subscribedRoomId);
        this.subscribedRoomId = undefined;
      }

      this.messages.set([]);

      if (currentRoomId) {
        this.subscribedRoomId = currentRoomId;
        this.centrifugo.subscribeLiveRoom(currentRoomId, (data) => {
          this.messages.update((prev) => [...prev, data]);
          this.scrollToBottom();
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.subscribedRoomId) {
        this.centrifugo.unsubscribeLiveRoom(this.subscribedRoomId);
      }
    });
  }

  sendMessage(): void {
    const content = this.inputText().trim();
    if (!content) return;
    this.centrifugo.publish(`room_${this.roomId()}`, {
      type: 'text',
      content,
    });
    this.inputText.set('');
    this.scrollToBottom();
  }

  onInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.inputText.set(target.value);
    }
  }

  private scrollToBottom(): void {
    const container = this.messagesContainer();
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}
