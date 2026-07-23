import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex" [class.justify-end]="isOwnMessage()" [class.justify-start]="!isOwnMessage()">
      <div class="max-w-[70%] rounded-lg p-3"
           [class.bg-blue-600]="isOwnMessage()"
           [class.text-white]="isOwnMessage()"
           [class.bg-gray-100]="!isOwnMessage()"
           [class.dark:bg-gray-800]="!isOwnMessage()">
        
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
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ChatMessageComponent {
  @Input({ required: true }) message!: ChatMessage;
  private authService = inject(AuthService);

  isOwnMessage(): boolean {
    return this.message.sender_id === this.authService.currentUser()?.id;
  }

  playVoice(): void {
    if (this.message.media_url) {
      const audio = new Audio(this.message.media_url);
      audio.play().catch(console.error);
    }
  }
}
