import { Component, input, output, signal, HostListener, ElementRef, inject } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { FavouriteService } from '../../services/favourite.service';
import { SafetyService } from '../../services/safety.service';
import { ChatMessage } from '../../services/chat.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-long-press-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative inline-block" (contextmenu)="onRightClick($event)">
      <ng-content></ng-content>
      
      @if (isMenuOpen()) {
        <div 
          class="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[180px]"
          [style.left.px]="menuPosition().x"
          [style.top.px]="menuPosition().y"
          (click)="$event.stopPropagation()"
        >
          @if (message()?.text_content) {
            <button 
              (click)="copyText()" 
              class="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
            >
              <span>📋</span> Copy Text
            </button>
          }
          
          @if (message()?.media_url) {
            <button 
              (click)="copyMediaUrl()" 
              class="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
            >
              <span>🔗</span> Copy Media URL
            </button>
          }
          
          <button 
            (click)="addToFavourites()" 
            class="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
          >
            <span>⭐</span> Add to Favourites
          </button>
          
          <div class="border-t border-gray-600 my-1"></div>
          
          <button 
            (click)="reportMessage()" 
            class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
          >
            <span>🚩</span> Report Message
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class LongPressContextMenuComponent {
  private clipboard = inject(Clipboard);
  private favouriteService = inject(FavouriteService);
  private safetyService = inject(SafetyService);
  private elementRef = inject(ElementRef);

  message = input<ChatMessage | null>(null);
  channelId = input<string>('');

  readonly menuClosed = output<void>();
  readonly favouriteAdded = output<string>();
  readonly reportSubmitted = output<string>();
  readonly copyTextOutput = output<string>();
  readonly copyMediaUrlOutput = output<string>();

  readonly isMenuOpen = signal(false);
  readonly menuPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly LONG_PRESS_DURATION = 500; // ms

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.longPressTimer = setTimeout(() => {
      const touch = event.touches[0];
      this.openMenu(touch.clientX, touch.clientY);
    }, this.LONG_PRESS_DURATION);
  }

  @HostListener('touchend')
  @HostListener('touchcancel')
  onTouchEnd(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isMenuOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isMenuOpen()) {
      this.closeMenu();
    }
  }

  onRightClick(event: MouseEvent): void {
    event.preventDefault();
    this.openMenu(event.clientX, event.clientY);
  }

  private openMenu(x: number, y: number): void {
    // Adjust position to keep menu within viewport
    const menuWidth = 180;
    const menuHeight = 200;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuWidth > viewportWidth) {
      adjustedX = viewportWidth - menuWidth - 10;
    }
    if (y + menuHeight > viewportHeight) {
      adjustedY = viewportHeight - menuHeight - 10;
    }

    this.menuPosition.set({ x: adjustedX, y: adjustedY });
    this.isMenuOpen.set(true);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
    this.menuClosed.emit();
  }

  copyText(): void {
    const text = this.message()?.text_content;
    if (text) {
      this.clipboard.copy(text);
      this.copyTextOutput.emit(text);
    }
    this.closeMenu();
  }

  copyMediaUrl(): void {
    const url = this.message()?.media_url;
    if (url) {
      this.clipboard.copy(url);
      this.copyMediaUrlOutput.emit(url);
    }
    this.closeMenu();
  }

  addToFavourites(): void {
    const msg = this.message();
    if (msg) {
      this.favouriteService.addFavourite({
        message_id: msg.id,
        note_text: msg.text_content?.substring(0, 100)
      }).subscribe({
        next: () => {
          this.favouriteAdded.emit(msg.id);
          this.closeMenu();
        },
        error: (err) => {
          console.error('Failed to add favourite:', err);
          this.closeMenu();
        }
      });
    }
  }

  reportMessage(): void {
    const msg = this.message();
    if (msg) {
      this.safetyService.reportUser({
        reported_id: msg.sender_id,
        reason: 'Inappropriate message content',
        context_url: `${window.location.origin}/chat/${this.channelId()}`
      }).subscribe({
        next: () => {
          this.reportSubmitted.emit(msg.id);
          this.closeMenu();
        },
        error: (err) => {
          console.error('Failed to report message:', err);
          this.closeMenu();
        }
      });
    }
  }
}
