import { Component, input, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService, ReadReceiptUser, MessageReceiptStatus } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-read-receipt',
  imports: [CommonModule, TranslatePipe],
  template: `
    <div
      class="inline-flex items-center relative"
      role="status"
      [attr.aria-label]="ariaLabel()"
      (mouseenter)="showDetail.set(true)"
      (mouseleave)="showDetail.set(false)"
      (click)="toggleDetail()"
      (keydown.enter)="toggleDetail()"
      (keydown.space)="toggleDetail()"
    >
      <!-- Sending: muted clock icon -->
      @if (displayStatus() === 'sending') {
        <svg class="w-3 h-3 text-text-muted animate-pulse" fill="currentColor" viewBox="0 0 16 16">
          <path
            d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm.5-10.75v4.19l2.97 1.72-.75 1.25L7.5 9.06V4.25h1z"
          />
        </svg>
      }

      <!-- Sent: single muted check -->
      @if (displayStatus() === 'sent') {
        <svg class="w-3 h-3 text-text-muted" fill="currentColor" viewBox="0 0 16 16">
          <path
            d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"
          />
        </svg>
      }

      <!-- Delivered: double muted check -->
      @if (displayStatus() === 'delivered') {
        <svg class="w-3 h-3 text-text-muted" fill="currentColor" viewBox="0 0 16 16">
          <path
            d="M3.72 8.78l1.06-1.06 2.22 2.22L7.25 9.7 3.78 6.22a.75.75 0 0 0-1.06 0L.47 8.47a.75.75 0 0 0 0 1.06l1.5 1.5a.75.75 0 0 0 1.06 0L5.53 8.53z"
          />
          <path
            d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"
          />
        </svg>
      }

      <!-- Read: double check in the Tide secondary tone -->
      @if (displayStatus() === 'read') {
        <svg class="w-3 h-3 text-secondary" fill="currentColor" viewBox="0 0 16 16">
          <path
            d="M3.72 8.78l1.06-1.06 2.22 2.22L7.25 9.7 3.78 6.22a.75.75 0 0 0-1.06 0L.47 8.47a.75.75 0 0 0 0 1.06l1.5 1.5a.75.75 0 0 0 1.06 0L5.53 8.53z"
          />
          <path
            d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"
          />
        </svg>
      }

      <!-- Tooltip on hover / tap for detailed read info -->
      @if (showDetail()) {
        <div
          class="absolute bottom-full end-0 mb-1 bg-surface-200 border border-surface-100 rounded-lg p-2 shadow-xl z-50 min-w-[180px]"
          role="tooltip"
        >
          <p class="text-xs text-text-secondary font-medium mb-1">
            {{ tooltipTitle() }}
          </p>
          @if (receiptData(); as data) {
            @for (reader of displayedReaders(); track reader.userId) {
              <div class="flex items-center gap-2 py-1">
                @if (reader.avatarUrl) {
                  <img
                    [src]="reader.avatarUrl"
                    class="w-5 h-5 rounded-full object-cover"
                    alt=""
                    loading="lazy"
                  />
                } @else {
                  <div
                    class="w-5 h-5 rounded-full bg-surface-400 flex items-center justify-center text-xs text-text-primary"
                  >
                    {{ reader.displayName.charAt(0) }}
                  </div>
                }
                <span class="text-xs text-text-primary truncate flex-1">
                  {{ reader.displayName }}
                </span>
                <span class="text-xs text-text-muted">
                  {{ formatTimeAgo(reader.readAt) }}
                </span>
              </div>
            }
            @if (hasGroupInfo()) {
              <p class="text-xs text-text-muted mt-1">
                {{
                  'readReceipts.readByCount'
                    | t: { read: data.readBy.length, total: data.totalMembers }
                }}
              </p>
            }
            @if (remainingCount() > 0) {
              <p class="text-xs text-text-muted mt-1">
                +{{ remainingCount() }} {{ 'readReceipts.more' | t }}
              </p>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        cursor: default;
      }
    `,
  ],
})
export class ReadReceiptComponent {
  messageId = input.required<string>();
  deliveryStatus = input<'sent' | 'delivered' | 'read'>();
  isGroup = input(false);

  private chatService = inject(ChatService);
  private i18n = inject(I18nService);

  showDetail = signal(false);
  receiptData = signal<MessageReceiptStatus | null>(null);

  displayStatus = signal<'sending' | 'sent' | 'delivered' | 'read' | null>(null);
  displayedReaders = signal<ReadReceiptUser[]>([]);
  remainingCount = signal(0);

  constructor() {
    effect(() => {
      const status = this.deliveryStatus();
      if (status) {
        this.displayStatus.set(status);
      }
    });

    effect(() => {
      if (this.showDetail()) {
        void this.loadReceipts();
      }
    });
  }

  hasGroupInfo(): boolean {
    const data = this.receiptData();
    return data !== null && data.totalMembers > 2 && data.readBy.length > 0;
  }

  ariaLabel(): string {
    const status = this.displayStatus();
    const data = this.receiptData();
    switch (status) {
      case 'sending':
        return this.i18n.translate('readReceipts.sending');
      case 'sent':
        return this.i18n.translate('readReceipts.sent');
      case 'delivered':
        return this.i18n.translate('readReceipts.delivered');
      case 'read':
        if (data && data.readBy.length > 0) {
          return this.i18n.translate('readReceipts.readByCount', {
            read: data.readBy.length,
            total: data.totalMembers,
          });
        }
        return this.i18n.translate('readReceipts.read');
      default:
        return '';
    }
  }

  tooltipTitle(): string {
    const status = this.displayStatus();
    switch (status) {
      case 'sent':
        return this.i18n.translate('readReceipts.sentTitle');
      case 'delivered':
        return this.i18n.translate('readReceipts.deliveredTitle');
      case 'read':
        return this.i18n.translate('readReceipts.readTitle');
      default:
        return '';
    }
  }

  toggleDetail(): void {
    this.showDetail.update((v) => !v);
  }

  private async loadReceipts(): Promise<void> {
    try {
      const data = await this.chatService.getMessageReceipts(this.messageId());
      this.receiptData.set(data);
      this.displayedReaders.set(data.readBy.slice(0, 5));
      const remaining = data.readBy.length - 5;
      this.remainingCount.set(remaining > 0 ? remaining : 0);
    } catch {
      this.receiptData.set(null);
    }
  }

  formatTimeAgo(isoString: string): string {
    if (!isoString) return '';
    const now = Date.now();
    const readTime = new Date(isoString).getTime();
    const seconds = Math.floor((now - readTime) / 1000);
    if (seconds < 60) return this.i18n.translate('time.justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return this.i18n.translate('time.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.i18n.translate('time.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return this.i18n.translate('time.daysAgo', { count: days });
  }
}
