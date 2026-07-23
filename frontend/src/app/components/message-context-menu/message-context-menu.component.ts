import { Component, input, output, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../services/chat.service';

@Component({
  selector: 'app-message-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50" (click)="close()" (touchstart)="close()">
      <div class="absolute" [style.top.px]="y()" [style.left.px]="x()">
        <div class="bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[160px]" (click)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()">
          <button (click)="onCopy()" class="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            Copy
          </button>
          <button (click)="onFavourite()" class="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            Favourite
          </button>
          <button (click)="onReport()" class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            Report
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MessageContextMenuComponent {
  message = input.required<ChatMessage>();
  x = input.required<number>();
  y = input.required<number>();

  copy = output<ChatMessage>();
  favourite = output<ChatMessage>();
  report = output<ChatMessage>();

  close() {
    // Emit undefined to signal close
    this.copy.emit(undefined as unknown as ChatMessage);
  }

  onCopy() {
    navigator.clipboard.writeText(this.message().text_content || '');
    this.copy.emit(this.message());
  }

  onFavourite() {
    this.favourite.emit(this.message());
  }

  onReport() {
    this.report.emit(this.message());
  }
}
