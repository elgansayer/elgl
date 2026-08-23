import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { notImplementedToast, showToast } from '../../services/toast.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, ChatRoom, ChatService } from '../../services/chat.service';
import { ChatPinsService } from '../../services/chat-pins.service';
import { UnreadCounterService } from '../../services/unread-counter.service';
import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { GroupsDiscoveryComponent } from '../groups-discovery/groups-discovery.component';
import { GroupsService, ChatGroup } from '../../services/groups.service';

interface ChatRoomPreview {
  id: string;
  title: string;
  subtitle: string;
  avatar: string;
  isOnline: boolean;
  isPinned: boolean;
  isVip: boolean;
  flagEmoji: string | null;
  lastMessageText: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

@Component({
  selector: 'app-chat-list',
  imports: [
    HlmInput,
    HlmButton,
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ScrollablePillsComponent,
    AppEmptyStateComponent,
    GroupsDiscoveryComponent,
  ],
  templateUrl: './chat-list.component.html',
})
export class ChatListComponent implements OnInit {
  private readonly chatService = inject(ChatService);
  private readonly chatPinsService = inject(ChatPinsService);
  private readonly authService = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly unreadCounter = inject(UnreadCounterService);
  private readonly groupsService = inject(GroupsService);

  readonly isLoading = signal<boolean>(true);
  readonly labels = signal<string[]>([]);
  readonly selectedLabel = signal<string | null>(null);
  readonly previews = signal<ChatRoomPreview[]>([]);
  readonly search = signal<string>('');
  readonly pinPendingRoomIds = signal<Set<string>>(new Set());
  readonly pinStateUnavailable = signal<boolean>(false);

  /** Active tab: 'chats' | 'groups' */
  readonly activeTab = signal<'chats' | 'groups'>('chats');
  readonly groups = signal<ChatGroup[]>([]);

  // ---------- Locked chat state ----------
  readonly lockedRoomIds = signal<string[]>([]);
  readonly showLocked = signal<boolean>(false);

  switchTab(tab: 'chats' | 'groups'): void {
    this.activeTab.set(tab);
    if (tab === 'groups' && this.groups().length === 0) {
      void this.groupsService.getDiscoverableGroups().then((groups) => this.groups.set(groups));
    }
  }

  async handleJoinGroup(groupId: string): Promise<void> {
    await this.groupsService.joinGroup(groupId);
    this.groups.set(await this.groupsService.getDiscoverableGroups());
  }

  readonly regularAndPinnedPreviews = computed(() => {
    const lockedIds = this.lockedRoomIds();
    return [...this.filteredPreviews()]
      .filter((preview) => !lockedIds.includes(preview.id))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  });
  readonly lockedPreviews = computed(() => {
    const lockedIds = this.lockedRoomIds();
    return this.previews().filter((p) => lockedIds.includes(p.id));
  });

  notImplemented(): void {
    notImplementedToast();
  }

  async loadLabels(): Promise<void> {
    try {
      const labels = await this.chatService.getLabels();
      this.labels.set(labels);
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  }

  async addLabel(label: string): Promise<void> {
    try {
      await this.chatService.addLabel(label);
      showToast(this.i18n.translate('chatList.labelAdded'), 'success');
    } catch (error) {
      console.error('Failed to add label:', error);
      showToast(this.i18n.translate('chatList.labelAddFailed'), 'error');
    }
  }

  async removeLabel(label: string): Promise<void> {
    try {
      await this.chatService.removeLabel(label);
      showToast(this.i18n.translate('chatList.labelRemoved'), 'success');
    } catch (error) {
      console.error('Failed to remove label:', error);
      showToast(this.i18n.translate('chatList.labelRemoveFailed'), 'error');
    }
  }

  async assignLabelToRoom(roomId: string, label: string): Promise<void> {
    try {
      await this.chatService.assignLabelToRoom(roomId, label);
      showToast(this.i18n.translate('chatList.labelAssigned'), 'success');
    } catch (error) {
      console.error('Failed to assign label to room:', error);
      showToast(this.i18n.translate('chatList.labelAssignFailed'), 'error');
    }
  }

  async removeLabelFromRoom(roomId: string, label: string): Promise<void> {
    try {
      await this.chatService.removeLabelFromRoom(roomId, label);
      showToast(this.i18n.translate('chatList.labelRemovedFromRoom'), 'success');
    } catch (error) {
      console.error('Failed to remove label from room:', error);
      showToast(this.i18n.translate('chatList.labelRemoveFromRoomFailed'), 'error');
    }
  }

  readonly filterPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'all', label: this.i18n.translate('chatList.filterAll') },
      { id: 'online', label: this.i18n.translate('chatList.filterOnline') },
      { id: 'unread', label: this.i18n.translate('chatList.filterUnread') },
      { id: 'my_turn', label: this.i18n.translate('chatList.filterMyTurn') },
      { id: 'timezone', label: this.i18n.translate('chatList.filterTimezone') },
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
    if (filter === 'online') result = result.filter((p) => p.isOnline);
    if (filter === 'unread') result = result.filter((p) => p.unreadCount > 0);

    if (!query) {
      return result;
    }
    return result.filter(
      (preview) =>
        preview.title.toLowerCase().includes(query) ||
        preview.subtitle.toLowerCase().includes(query) ||
        preview.lastMessageText.toLowerCase().includes(query),
    );
  });

  readonly pinnedPreviews = computed(() =>
    this.filteredPreviews().filter((preview) => preview.isPinned),
  );
  readonly regularPreviews = computed(() =>
    this.filteredPreviews().filter((preview) => !preview.isPinned),
  );

  async ngOnInit(): Promise<void> {
    await this.loadPreviews();
    await Promise.all([this.loadPinnedRooms(), this.loadLockedRooms(), this.loadLabels()]);
  }

  async loadPreviews(): Promise<void> {
    this.isLoading.set(true);
    try {
      const rooms = await this.chatService.getRooms();

      const previewList = await Promise.all(
        rooms.map(async (room) => {
          const messages = await this.loadRoomMessages(room.id);
          return this.toPreview(room, messages);
        }),
      );

      previewList.sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });

      this.previews.set(previewList);
      const totalChatUnread = previewList.reduce((sum, p) => sum + p.unreadCount, 0);
      this.unreadCounter.setChatUnread(totalChatUnread);
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
      this.previews.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadPinnedRooms(): Promise<void> {
    try {
      const ids = new Set(await this.chatPinsService.getPinnedRoomIds());
      this.previews.update((previews) =>
        previews.map((preview) => ({ ...preview, isPinned: ids.has(preview.id) })),
      );
      this.pinStateUnavailable.set(false);
    } catch (error) {
      console.error('Failed to load pinned chats:', error);
      this.previews.update((previews) =>
        previews.map((preview) => ({ ...preview, isPinned: false })),
      );
      this.pinStateUnavailable.set(true);
    }
  }

  isPinPending(roomId: string): boolean {
    return this.pinPendingRoomIds().has(roomId);
  }

  pinActionLabel(preview: ChatRoomPreview): string {
    return `${preview.isPinned ? 'Unpin' : 'Pin'} ${preview.title}`;
  }

  async toggleRoomPin(event: Event, preview: ChatRoomPreview): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (this.isPinPending(preview.id)) return;

    const desiredPinned = !preview.isPinned;
    this.pinPendingRoomIds.update((ids) => new Set(ids).add(preview.id));

    try {
      await this.chatPinsService.setPinned(preview.id, desiredPinned);
      this.previews.update((previews) =>
        previews.map((room) =>
          room.id === preview.id ? { ...room, isPinned: desiredPinned } : room,
        ),
      );
      this.pinStateUnavailable.set(false);
    } catch (error) {
      console.error('Failed to update pinned chat:', error);
      showToast(this.i18n.translate('common.error_generic'), 'error');
    } finally {
      this.pinPendingRoomIds.update((ids) => {
        const next = new Set(ids);
        next.delete(preview.id);
        return next;
      });
    }
  }

  private async loadLockedRooms(): Promise<void> {
    try {
      const ids = await this.chatService.getLockedRoomIds();
      this.lockedRoomIds.set(ids);
    } catch {
      this.lockedRoomIds.set([]);
    }
  }

  async toggleLockedFolder(): Promise<void> {
    if (this.showLocked()) {
      this.showLocked.set(false);
      return;
    }
    await this.authService.unlockApp();
    if (!this.authService.appLocked()) {
      this.showLocked.set(true);
    }
  }

  isRoomLocked(roomId: string): boolean {
    return this.lockedRoomIds().includes(roomId);
  }

  async toggleRoomLock(event: Event, roomId: string): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const wasLocked = this.isRoomLocked(roomId);
    try {
      if (wasLocked) {
        await this.chatService.unlockChat(roomId);
        this.lockedRoomIds.update((ids) => ids.filter((id) => id !== roomId));
        showToast(this.i18n.translate('chatList.chatUnlocked'), 'success');
      } else {
        await this.chatService.lockChat(roomId);
        this.lockedRoomIds.update((ids) => [...ids, roomId]);
        showToast(this.i18n.translate('chatList.chatLocked'), 'success');
      }
    } catch (error) {
      console.error('Failed to update chat lock status:', error);
      showToast(this.i18n.translate('chatList.lockActionFailed'), 'error');
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

  private toPreview(room: ChatRoom, messages: ChatMessage[]): ChatRoomPreview {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const currentUserId = this.authService.currentUser()?.id;

    const unreadCount = messages.filter(
      (message) => !message.is_read && message.sender_id !== currentUserId,
    ).length;

    return {
      id: room.id,
      title: room.title,
      subtitle: room.subtitle,
      avatar: room.avatar,
      isOnline: room.is_online,
      isPinned: false,
      isVip: room.is_vip ?? false,
      flagEmoji: this.getFlagEmoji(room.native_languages),
      lastMessageText: this.toMessagePreview(lastMessage),
      lastMessageAt: lastMessage?.created_at ?? null,
      unreadCount,
    };
  }

  private getFlagEmoji(languages?: string[]): string | null {
    if (!languages || languages.length === 0) return null;
    const flagMap: Record<string, string> = {
      en: '\u{1F1EC}\u{1F1E7}',
      es: '\u{1F1EA}\u{1F1F8}',
      fr: '\u{1F1EB}\u{1F1F7}',
      de: '\u{1F1E9}\u{1F1EA}',
      it: '\u{1F1EE}\u{1F1F9}',
      pt: '\u{1F1F5}\u{1F1F9}',
      ru: '\u{1F1F7}\u{1F1FA}',
      zh: '\u{1F1E8}\u{1F1F3}',
      ja: '\u{1F1EF}\u{1F1F5}',
      ko: '\u{1F1F0}\u{1F1F7}',
      ar: '\u{1F1F8}\u{1F1E6}',
      hi: '\u{1F1EE}\u{1F1F3}',
      tr: '\u{1F1F9}\u{1F1F7}',
      nl: '\u{1F1F3}\u{1F1F1}',
      pl: '\u{1F1F5}\u{1F1F1}',
      sv: '\u{1F1F8}\u{1F1EA}',
      da: '\u{1F1E9}\u{1F1F0}',
      fi: '\u{1F1EB}\u{1F1EE}',
      no: '\u{1F1F3}\u{1F1F4}',
      cs: '\u{1F1E8}\u{1F1FF}',
      he: '\u{1F1EE}\u{1F1F1}',
      th: '\u{1F1F9}\u{1F1ED}',
      vi: '\u{1F1FB}\u{1F1F3}',
      id: '\u{1F1EE}\u{1F1E9}',
    };
    return flagMap[languages[0]] ?? null;
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
