import { Component, input, inject, ViewChild, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { SafetyService } from '../../services/safety.service';

export interface ChatMessage {
  id: string;
  sender_id: string;
  text_content?: string;
  message_type: string;
  room_id: string;
  created_at?: string;
}

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, LongPressContextMenuComponent],
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.css'],
})
export class ChatMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly currentUserId = input<string>('');

  @ViewChild(LongPressContextMenuComponent) contextMenu?: LongPressContextMenuComponent;

  private readonly safetyService = inject(SafetyService);

  readonly isSenderBlocked = computed(() => {
    const sid = this.message()?.sender_id;
    if (!sid) return false;
    return this.safetyService.isUserBlockedCached(sid);
  });

  get isContextMenuDisabled(): boolean {
    const msg = this.message();
    return !msg || msg.sender_id === 'system' || msg.sender_id === null;
  }

  onCopy(event: { messageId: string; content: string }): void {
    navigator.clipboard.writeText(event.content).catch(() => {});
  }

  onFavourite(event: { messageId: string; content: string; messageType: string }): void {
    // TODO: implement favourite saving
  }

  onReport(event: { messageId: string; content: string; senderId: string; roomId: string }): void {
    // TODO: open report modal
  }

  onBlockUnblock(event: { senderId: string; blocked: boolean }): void {
    const op = event.blocked
      ? this.safetyService.blockUserAsync(event.senderId)
      : this.safetyService.unblockUserAsync(event.senderId);
    void op.catch(() => {});
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: MouseEvent): void {
    if (this.isContextMenuDisabled || !this.contextMenu) return;
    event.preventDefault();
    this.contextMenu.showMenu(event);
  }
}
