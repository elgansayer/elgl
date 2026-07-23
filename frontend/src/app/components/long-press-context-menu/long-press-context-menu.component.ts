import { Component, input, output, signal, HostListener, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-long-press-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      #menuContainer
      *ngIf="isVisible()"
      class="fixed z-50 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl overflow-hidden min-w-[180px] animate-fade-in"
      [style.left.px]="position().x"
      [style.top.px]="position().y"
      (click)="$event.stopPropagation()"
    >
      <button
        (click)="onCopy()"
        class="w-full text-start px-4 py-3 text-sm text-gray-200 hover:bg-gray-800/80 transition-colors flex items-center gap-3 border-b border-gray-700/50"
      >
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        Copy Message
      </button>
      <button
        (click)="onFavourite()"
        class="w-full text-start px-4 py-3 text-sm text-gray-200 hover:bg-gray-800/80 transition-colors flex items-center gap-3 border-b border-gray-700/50"
      >
        <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        Add to Favourites
      </button>
      <button
        (click)="onReport()"
        class="w-full text-start px-4 py-3 text-sm text-red-400 hover:bg-red-900/30 transition-colors flex items-center gap-3"
      >
        <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
        </svg>
        Report Message
      </button>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fade-in {
      animation: fadeIn 0.15s ease-out;
    }
  `]
})
export class LongPressContextMenuComponent implements AfterViewInit {
  @ViewChild('menuContainer') menuContainer!: ElementRef;

  readonly messageId = input.required<string>();
  readonly messageContent = input.required<string>();
  readonly messageType = input.required<string>();
  readonly senderId = input.required<string>();
  readonly roomId = input.required<string>();

  readonly copy = output<string>();
  readonly favourite = output<{ messageId: string; messageContent: string; messageType: string }>();
  readonly report = output<{ messageId: string; senderId: string; roomId: string }>();
  readonly close = output<void>();

  readonly isVisible = signal(false);
  readonly position = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  private touchStartTime = 0;
  private touchStartPos = { x: 0, y: 0 };
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly LONG_PRESS_DURATION = 500;
  private readonly MOVE_THRESHOLD = 10;

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.menuContainer?.nativeElement) {
        const rect = this.menuContainer.nativeElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let x = this.position().x;
        let y = this.position().y;

        if (x + rect.width > viewportWidth) {
          x = viewportWidth - rect.width - 8;
        }
        if (y + rect.height > viewportHeight) {
          y = viewportHeight - rect.height - 8;
        }
        if (x < 0) x = 8;
        if (y < 0) y = 8;

        this.position.set({ x, y });
      }
    });
  }

  @HostListener('document:touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    this.touchStartTime = Date.now();
    this.touchStartPos = { x: touch.clientX, y: touch.clientY };

    this.longPressTimer = setTimeout(() => {
      if (!this.isVisible()) {
        this.position.set({
          x: touch.clientX,
          y: touch.clientY
        });
        this.isVisible.set(true);
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }, this.LONG_PRESS_DURATION);
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (!this.longPressTimer) return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - this.touchStartPos.x);
    const dy = Math.abs(touch.clientY - this.touchStartPos.y);
    if (dx > this.MOVE_THRESHOLD || dy > this.MOVE_THRESHOLD) {
      this.clearLongPress();
    }
  }

  @HostListener('document:touchend')
  @HostListener('document:touchcancel')
  onTouchEnd() {
    this.clearLongPress();
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.isVisible()) {
      this.hide();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.isVisible()) {
      this.hide();
    }
  }

  private clearLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private hide() {
    this.isVisible.set(false);
    this.close.emit();
  }

  onCopy() {
    navigator.clipboard.writeText(this.messageContent()).then(() => {
      this.copy.emit(this.messageContent());
      this.hide();
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = this.messageContent();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.copy.emit(this.messageContent());
      this.hide();
    });
  }

  onFavourite() {
    this.favourite.emit({
      messageId: this.messageId(),
      messageContent: this.messageContent(),
      messageType: this.messageType()
    });
    this.hide();
  }

  onReport() {
    this.report.emit({
      messageId: this.messageId(),
      senderId: this.senderId(),
      roomId: this.roomId()
    });
    this.hide();
  }
}
