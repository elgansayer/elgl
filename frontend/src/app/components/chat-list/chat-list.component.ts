import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, ChatService } from '../../services/chat.service';

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
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat-list.component.html'
})
export class ChatListComponent implements OnInit {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);

  readonly isLoading = signal<boolean>(true);
  readonly previews = signal<ChatRoomPreview[]>([]);
  readonly search = signal<string>('');

  readonly filteredPreviews = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) {
      return this.previews();
    }
    return this.previews().filter((preview) =>
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

  async loadPreviews(): Promise<void> {
    this.isLoading.set(true);
    const rooms: Array<{
      id: string;
      title: string;
      subtitle: string;
      avatar: string;
      isOnline: boolean;
      isPinned: boolean;
    }> = [
      {
        id: 'global-exchange',
        title: 'Global Exchange',
        subtitle: 'General language room',
        avatar: '🌍',
        isOnline: true,
        isPinned: true
      },
      {
        id: 'english-spanish',
        title: 'English ↔ Spanish',
        subtitle: 'Partner corrections',
        avatar: '🇬🇧🇪🇸',
        isOnline: true,
        isPinned: true
      },
      {
        id: 'japanese-beginners',
        title: 'Japanese Beginners',
        subtitle: 'Short sentence practice',
        avatar: '🇯🇵',
        isOnline: false,
        isPinned: false
      },
      {
        id: 'arabic-english',
        title: 'Arabic ↔ English',
        subtitle: 'Pronunciation help',
        avatar: '🇸🇦🇬🇧',
        isOnline: false,
        isPinned: false
      }
    ];

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
    this.isLoading.set(false);
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
    room: {
      id: string;
      title: string;
      subtitle: string;
      avatar: string;
      isOnline: boolean;
      isPinned: boolean;
    },
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
      isOnline: room.isOnline,
      isPinned: room.isPinned,
      lastMessageText: this.toMessagePreview(lastMessage),
      lastMessageAt: lastMessage?.created_at ?? null,
      unreadCount
    };
  }

  private toMessagePreview(message: ChatMessage | null): string {
    if (!message) {
      return 'No messages yet. Start a chat.';
    }
    if (message.message_type === 'text') {
      return message.text_content || 'Text message';
    }
    if (message.message_type === 'correction') {
      return 'Sent a correction';
    }
    if (message.message_type === 'voice') {
      return 'Sent a voice note';
    }
    return 'Sent a doodle';
  }
}
