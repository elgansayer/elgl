import { showToast, notImplementedToast } from '../../services/toast.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, ChatRoom, ChatService } from '../../services/chat.service';
import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';

interface ChatRoomPreview {
  id: string;
  title: string;
  subtitle: string;
  avatar: string;
  isOnline: boolean;
  isPinned: boolean;
  lastMessageText: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

@Component({
  selector: 'app-chat-list',
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, ScrollablePillsComponent],
  templateUrl: './chat-list.component.html'
})
export class ChatListComponent implements OnInit {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly isLoading = signal<boolean>(true);
  readonly previews = signal<ChatRoomPreview[]>([]);
  readonly search = signal<string>('');
  
  readonly filterPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'all', label: this.i18n.translate('chatList.filterAll') },
      { id: 'online', label: this.i18n.translate('chatList.filterOnline') },
      { id: 'unread', label: this.i18n.translate('chatList.filterUnread') },
      { id: 'my_turn', label: this.i18n.translate('chatList.filterMyTurn') },
      { id: 'timezone', label: this.i18n.translate('chatList.filterTimezone') }
    ];
  });
  readonly selectedFilter = signal<string>('all');

  onFilterSelect(id: string) {
    this.selectedFilter.set(id);
  }

  readonly filteredPreviews = computed(() => {
    const query = this.search().trim().toLowerCase();
    const filter = this.selectedFilter();
    
    let result = this.previews();
    if (filter === 'online') result = result.filter(p => p.isOnline);
    if (filter === 'unread') result = result.filter(p => p.unreadCount > 0);
    
    if (!query) {
      return result;
    }
    return result.filter((preview) =>
      preview.title.toLowerCase().includes(query) ||
      preview.subtitle.toLowerCase().includes(query) ||
      preview.lastMessageText.toLowerCase().includes(query)
    );
  });

  readonly pinnedPreviews = computed(() => this.filteredPreviews().filter((preview) => preview.isPinned));
  readonly regularPreviews = computed(() => this.filteredPreviews().filter((preview) => !preview.isPinned));

  async ngOnInit(): Promise<void> {
    await this.loadPreviews();
  }

  notImplemented(): void {
    notImplementedToast();
  }

  async loadPreviews(): Promise<void> {
    this.isLoading.set(true);
    try {
      const rooms = await this.chatService.getRooms();

      const previewList = await Promise.all(
        rooms.map(async (room) => {
          const messages = await this.loadRoomMessages(room.id);
          return this.toPreview(room, messages);
        })
      );

      previewList.sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });

      this.previews.set(previewList);
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
      this.previews.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadRoomMessages(roomId: string): Promise<ChatMessage[]> {
    try {
      return await this.chatService.getMessages(roomId);
    } catch (error) {
      console.error(`Failed to load room preview for ${roomId}:`, error);
      return [];
    }
  }

  private toPreview(
    room: ChatRoom,
    messages: ChatMessage[]
  ): ChatRoomPreview {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const currentUserId = this.authService.currentUser()?.id;

    const unreadCount = messages.filter(
      (message) => !message.is_read && message.sender_id !== currentUserId
    ).length;

    return {
      id: room.id,
      title: room.title,
      subtitle: room.subtitle,
      avatar: room.avatar,
      isOnline: room.is_online,
      isPinned: room.is_pinned,
      lastMessageText: this.toMessagePreview(lastMessage),
      lastMessageAt: lastMessage?.created_at ?? null,
      unreadCount
    };
  }

  private toMessagePreview(message: ChatMessage | null): string {
    if (!message) {
      return this.i18n.translate('chatList.noMessagesYet');
    }
    if (message.message_type === 'text') {
      return message.text_content || this.i18n.translate('chatList.textMessage');
    }
    if (message.message_type === 'correction') {
      return this.i18n.translate('chatList.sentCorrection');
    }
    if (message.message_type === 'voice') {
      return this.i18n.translate('chatList.sentVoice');
    }
    return this.i18n.translate('chatList.sentDoodle');
  }
}
