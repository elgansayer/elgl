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
import { CentrifugeService, RoomLiveMessage } from '../../services/centrifuge.service';
import { DraftService } from '../../services/draft.service';

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

  private readonly centrifuge = inject(CentrifugeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly draftService = inject(DraftService);
  private readonly messagesContainer = viewChild<HTMLElement>('messagesContainer');
  private subscribedRoomId?: string;

  constructor() {
    effect(() => {
      const currentRoomId = this.roomId();
      if (this.subscribedRoomId && this.subscribedRoomId !== currentRoomId) {
        // Save draft for the previous room before switching
        this.draftService.saveChatDraft(this.subscribedRoomId, this.inputText());
        this.centrifuge.unsubscribeLiveRoom(this.subscribedRoomId);
        this.subscribedRoomId = undefined;
      }

      this.messages.set([]);

      if (currentRoomId) {
        this.subscribedRoomId = currentRoomId;
        // Restore saved draft for the new room
        const draft = this.draftService.loadChatDraft(currentRoomId);
        if (draft) {
          this.inputText.set(draft);
        }
        this.centrifuge.subscribeLiveRoom(currentRoomId, (data) => {
          this.messages.update((prev) => [...prev, data]);
          this.scrollToBottom();
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.subscribedRoomId) {
        this.draftService.saveChatDraft(this.subscribedRoomId, this.inputText());
        this.centrifuge.unsubscribeLiveRoom(this.subscribedRoomId);
      }
    });
  }

  sendMessage(): void {
    const content = this.inputText().trim();
    if (!content) return;
    this.centrifuge.publish(`room_${this.roomId()}`, {
      type: 'text',
      content,
    });
    this.inputText.set('');
    this.draftService.clearChatDraft(this.roomId());
    this.scrollToBottom();
  }

  onInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.inputText.set(target.value);
      this.draftService.saveChatDraft(this.roomId(), target.value);
    }
  }

  private scrollToBottom(): void {
    const container = this.messagesContainer();
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}
