import { Component, input, signal, viewChild } from '@angular/core';
import { ChatRoomComponent } from '../../components/chat-room/chat-room.component';
import { ConversationStarterPanelComponent } from '../../components/chat-room/conversation-starter-panel.component';

interface ConversationStarterComposerTarget {
  messages: () => readonly unknown[];
  textInput: string;
  saveChatDrafts: () => void;
}

export function applyConversationStarterToComposer(
  target: ConversationStarterComposerTarget,
  suggestion: string,
): boolean {
  const cleaned = suggestion.replace(/\s+/gu, ' ').trim().slice(0, 160);
  if (!cleaned || target.messages().length > 0 || target.textInput.trim()) {
    return false;
  }
  target.textInput = cleaned;
  target.saveChatDrafts();
  return true;
}

@Component({
  selector: 'app-chat-room-page',
  imports: [ChatRoomComponent, ConversationStarterPanelComponent],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-3" (input)="onInput($event)">
      <app-conversation-starter-panel
        [roomId]="id()"
        [chatLoading]="chatRoom()?.isLoading() ?? true"
        [messageCount]="chatRoom()?.messages().length ?? 0"
        [composerText]="composerText() || (chatRoom()?.textInput ?? '')"
        (suggestionSelected)="useSuggestion($event)"
      />
      <app-chat-room [id]="id()" />
    </div>
  `,
})
export class ChatRoomPageComponent {
  readonly id = input.required<string>();
  readonly composerText = signal('');
  private readonly chatRoom = viewChild(ChatRoomComponent);

  onInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.getAttribute('data-testid') !== 'chat-message-input') return;
    this.composerText.set(target.value);
  }

  useSuggestion(suggestion: string): void {
    const room = this.chatRoom();
    if (!room) return;
    if (applyConversationStarterToComposer(room, suggestion)) {
      this.composerText.set(room.textInput);
    }
  }
}
