import {
  Component,
  ElementRef,
  HostListener,
  inject,
  Input,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, ChatRoom } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);

  @Input() roomId!: string;

  @ViewChild('messageList') messageListRef!: ElementRef<HTMLDivElement>;

  messages = signal<ChatMessage[]>([]);
  rooms = signal<ChatRoom[]>([]);
  currentUserId = signal<string | null>(null);
  newMessageText = signal<string>('');
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(false);

  // Context menu state
  contextMenuVisible = signal<boolean>(false);
  contextMenuPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  contextMenuMessage = signal<ChatMessage | null>(null);

  // Long-press detection
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTriggered = false;

  // Search debounce
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  ngOnInit(): void {
    this.currentUserId.set(this.authService.getUserId() ?? null);
    this.loadRooms();
    this.loadMessages();

    // Debounced search
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.loadMessages();
      });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.clearLongPress();
  }

  // ---------- Data Loading ----------

  async loadRooms(): Promise<void> {
    try {
      const rooms = await this.chatService.getRooms();
      this.rooms.set(rooms);
    } catch {
      // silently fail
    }
  }

  async loadMessages(): Promise<void> {
    this.isLoading.set(true);
    try {
      const msgs = await this.chatService.getMessages(
        this.roomId,
        this.searchQuery() || undefined,
      );
      this.messages.set(msgs);
      this.scrollToBottom();
    } catch {
      // silently fail
    } finally {
      this.isLoading.set(false);
    }
  }

  // ---------- Send Message ----------

  async sendMessage(): Promise<void> {
    const text = this.newMessageText().trim();
    if (!text) return;

    this.newMessageText.set('');
    try {
      await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'text',
        text_content: text,
      });
      await this.loadMessages();
    } catch {
      // silently fail
    }
  }

  // ---------- Search ----------

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  // ---------- Long Press (for context menu) ----------

  onPointerDown(event: PointerEvent, message: ChatMessage): void {
    // Only trigger on left click (button === 0)
    if (event.button !== 0) return;

    this.longPressTriggered = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.showContextMenu(event, message);
    }, 500); // 500ms long press
  }

  onPointerUp(event: PointerEvent): void {
    this.clearLongPress();
    // If long press was triggered, prevent default click behaviour
    if (this.longPressTriggered) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  onPointerLeave(): void {
    this.clearLongPress();
  }

  private clearLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressTriggered = false;
  }

  // ---------- Context Menu ----------

  showContextMenu(event: PointerEvent, message: ChatMessage): void {
    event.preventDefault();
    this.contextMenuMessage.set(message);
    this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
    this.contextMenuVisible.set(true);
  }

  hideContextMenu(): void {
    this.contextMenuVisible.set(false);
    this.contextMenuMessage.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close context menu when clicking outside
    if (this.contextMenuVisible()) {
      this.hideContextMenu();
    }
  }

  // ---------- Context Menu Actions ----------

  async addToFavourites(): Promise<void> {
    const msg = this.contextMenuMessage();
    if (!msg) return;
    this.hideContextMenu();
    try {
      await this.chatService.addFavourite(msg.id);
    } catch {
      // silently fail
    }
  }

  async copyMessageText(): Promise<void> {
    const msg = this.contextMenuMessage();
    if (!msg?.text_content) return;
    this.hideContextMenu();
    try {
      await navigator.clipboard.writeText(msg.text_content);
    } catch {
      // silently fail
    }
  }

  // ---------- Utility ----------

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messageListRef?.nativeElement) {
        this.messageListRef.nativeElement.scrollTop =
          this.messageListRef.nativeElement.scrollHeight;
      }
    }, 0);
  }

  isOwnMessage(message: ChatMessage): boolean {
    return message.sender_id === this.currentUserId();
  }
}
