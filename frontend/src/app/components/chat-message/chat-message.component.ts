import { Component, Input, inject, computed, signal, OnInit, OnDestroy, ViewChild, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { FavouriteService } from '../../services/favourite.service';
import { SafetyService } from '../../services/safety.service';
import { I18nService } from '../../services/i18n.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, LongPressContextMenuComponent],
  template: `
    <app-long-press-context-menu
      [messageId]="message.id"
      [messageContent]="message.text_content ?? ''"
      [messageType]="message.message_type"
      [senderId]="message.sender_id"
      [roomId]="message.room_id"
      [isBlocked]="isBlocked()"
      (copy)="onCopy($event)"
      (favourite)="onFavourite($event)"
      (report)="onReport($event)"
      (block)="onBlock($event)"
    >
      <ng-container *ngIf="!isBlocked(); else blockedMessage">
        <div class="flex" [class.justify-end]="isOwnMessage()" [class.justify-start]="!isOwnMessage()">
          <div class="max-w-[70%] rounded-lg p-3"
               [class.bg-blue-600]="isOwnMessage()"
               [class.text-white]="isOwnMessage()"
               [class.bg-surface-300]="!isOwnMessage()"
               [class.]="!isOwnMessage()">
            
            <!-- Text message -->
            <p *ngIf="message.message_type === 'text'" class="text-sm">{{ message.text_content }}</p>

            <!-- Voice message -->
            <div *ngIf="message.message_type === 'voice'" class="flex items-center gap-2">
              <button (click)="playVoice()" class="p-2 rounded-full hover:bg-black/10">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                </svg>
              </button>
              <span class="text-sm">Voice message</span>
            </div>

            <!-- Correction message -->
            <div *ngIf="message.message_type === 'correction' && message.correction_payload" class="space-y-1">
              <p class="text-sm line-through opacity-75">{{ message.correction_payload.original }}</p>
              <p class="text-sm font-medium">{{ message.correction_payload.corrected }}</p>
              <p *ngIf="message.correction_payload.explanation" class="text-xs opacity-75 mt-1">
                {{ message.correction_payload.explanation }}
              </p>
            </div>

            <!-- Doodle message -->
            <div *ngIf="message.message_type === 'doodle' && message.media_url">
              <img [src]="message.media_url" class="max-w-full rounded" alt="Doodle">
            </div>

            <!-- Timestamp -->
            <p class="text-xs mt-1 opacity-60 text-right">{{ message.created_at | date:'shortTime' }}</p>
          </div>
        </div>
      </ng-container>
      <ng-template #blockedMessage>
        <div class="flex justify-center">
          <div class="bg-gray-800/50 rounded-lg p-3 text-center text-gray-400 text-sm italic max-w-[80%]">
            <p>{{ i18n.translate('chat.message_blocked') }}</p>
            <button 
              (click)="unblockUser()" 
              class="text-blue-400 hover:text-blue-300 text-xs mt-2 underline">
              {{ i18n.translate('chat.unblock_user') }}
            </button>
          </div>
        </div>
      </ng-template>
    </app-long-press-context-menu>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ChatMessageComponent implements OnInit, OnDestroy {
  @Input({ required: true }) message!: ChatMessage;
  @Input() currentUserId?: string;
  
  @ViewChild(LongPressContextMenuComponent) contextMenu!: LongPressContextMenuComponent;

  readonly messageBlocked = output<string>();

  private authService = inject(AuthService);
  private favouriteService = inject(FavouriteService);
  private safetyService = inject(SafetyService);
  private chatService = inject(ChatService);
  private i18n = inject(I18nService);
  private destroy$ = new Subject<void>();

  isBlocked = signal(false);

  ngOnInit(): void {
    // Load blocked users from backend to pre-populate the blocked set
    this.chatService.loadBlockedUsers();
    
    // Check if this message sender is blocked using the local cached set first
    if (this.message.sender_id) {
      // First check the local cached set (faster)
      if (this.chatService.isUserBlocked()(this.message.sender_id)) {
        this.isBlocked.set(true);
      } else {
        // Then check the backend for a definitive answer
        this.safetyService.isBlocked(this.message.sender_id).then((result) => {
          this.isBlocked.set(result.blocked);
        }).catch(err => console.error('Failed to check block status', err));
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isOwnMessage(): boolean {
    if (this.currentUserId != null) {
      return this.message.sender_id === this.currentUserId;
    }
    return this.message.sender_id === this.authService.currentUser()?.id;
  }

  playVoice(): void {
    if (this.message.media_url) {
      const audio = new Audio(this.message.media_url);
      audio.play().catch(console.error);
    }
  }

  onCopy(event: { messageId: string; content: string }): void {
    navigator.clipboard.writeText(event.content).catch(console.error);
  }

  onFavourite(event: { messageId: string; content: string; messageType: string }): void {
    this.favouriteService.addFavourite({ message_id: event.messageId }).subscribe({
      next: () => console.log('Favourite added'),
      error: (err) => console.error('Failed to add favourite', err),
    });
  }

  onReport(event: { messageId: string; content: string; senderId: string; roomId: string }): void {
    this.safetyService.reportUser({
      reported_id: event.senderId,
      reason_category: 'inappropriate_content',
      description: 'Inappropriate message',
      context_url: window.location.href,
    }).subscribe({
      next: () => console.log('Report submitted'),
      error: (err) => console.error('Failed to report', err),
    });
  }

  async onBlock(event: { senderId: string; blocked: boolean }): Promise<void> {
    this.isBlocked.set(event.blocked);
    if (event.blocked) {
      try {
        await this.safetyService.blockUserAsync(event.senderId);
      } catch (err) {
        console.error('Failed to block user', err);
        this.isBlocked.set(false);
        return;
      }
      this.chatService.addBlockedUser(event.senderId);
      this.messageBlocked.emit(event.senderId);
    } else {
      try {
        await this.safetyService.unblockUserAsync(event.senderId);
      } catch (err) {
        console.error('Failed to unblock user', err);
        this.isBlocked.set(true);
        return;
      }
      this.chatService.removeBlockedUser(event.senderId);
    }
  }

  async unblockUser(): Promise<void> {
    if (this.message.sender_id) {
      try {
        await this.safetyService.unblockUserAsync(this.message.sender_id);
        this.isBlocked.set(false);
        this.chatService.removeBlockedUser(this.message.sender_id);
      } catch (err) {
        console.error('Failed to unblock user', err);
      }
    }
  }

  onContextMenu(event: MouseEvent): void {
    if (this.contextMenu) {
      this.contextMenu.showMenu(event);
    }
  }
}
