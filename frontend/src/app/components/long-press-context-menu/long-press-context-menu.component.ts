import { Component, input, model, output, signal, ElementRef, inject } from '@angular/core';

import { ReportUserModalService } from '../report-user-modal/report-user-modal.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-long-press-context-menu',
  imports: [TranslatePipe],
  template: `
    @if (showMenu()) {
      <div
        class="context-menu-popup"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
        (keydown.enter)="$event.stopPropagation()"
        tabindex="0"
      >
        <ul class="menu-items">
          <li>
            <button
              type="button"
              role="menuitem"
              (click)="onOptionClick('copy')"
              [disabled]="disabled()"
            >
              {{ 'context_menu.copy' | t }}
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              (click)="onOptionClick('favourite')"
              [disabled]="disabled()"
            >
              {{ 'context_menu.favourite' | t }}
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              (click)="onOptionClick('report')"
              [disabled]="disabled()"
            >
              {{ 'context_menu.report' | t }}
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              (click)="onOptionClick('block')"
              [disabled]="disabled()"
            >
              {{ (isBlocked() ? 'context_menu.unblock' : 'context_menu.block') | t }}
            </button>
          </li>
        </ul>
      </div>
    }
  `,
  styles: [
    `
      .context-menu-popup {
        background: var(--surface-card, #1e293b);
        border-radius: 0.75rem;
        padding: 0.5rem 0;
        min-width: 180px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      }
      .menu-items {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .menu-items li {
        padding: 0.25rem 0;
      }
      .menu-items button {
        display: block;
        width: 100%;
        padding: 0.5rem 1rem;
        text-align: start;
        background: none;
        border: none;
        color: var(--text-primary, #e2e8f0);
        font-size: 0.9rem;
        cursor: pointer;
      }
      .menu-items button:hover {
        background: var(--surface-hover, #334155);
      }
      .menu-items button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
    '(window:resize)': 'onResize()',
    '(window:scroll)': 'onScroll()',
  },
})
export class LongPressContextMenuComponent {
  readonly messageId = input<string>('');
  readonly messageContent = input<string>('');
  readonly messageType = input<string>('text');
  readonly senderId = input<string>('');
  readonly roomId = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly longPressDuration = input<number>(600);
  readonly isBlocked = input<boolean>(false);

  showMenu = model(false);
  position = signal({ x: 0, y: 0 });

  readonly copyMessage = output<{ messageId: string; content: string }>();
  readonly favourite = output<{
    messageId: string;
    content: string;
    messageType: string;
  }>();
  readonly block = output<{ senderId: string; blocked: boolean }>();

  longPressTimer: ReturnType<typeof setTimeout> | null = null;

  private elementRef = inject(ElementRef);
  private readonly reportModalService = inject(ReportUserModalService);

  onOptionClick(option: string): void {
    if (option === 'copy') {
      this.copyMessage.emit({ messageId: this.messageId(), content: this.messageContent() });
      this.close();
    } else if (option === 'favourite') {
      this.favourite.emit({
        messageId: this.messageId(),
        content: this.messageContent(),
        messageType: this.messageType(),
      });
      this.close();
    } else if (option === 'report') {
      this.close();
      this.reportModalService.open(this.senderId(), this.buildContextUrl());
    } else if (option === 'block') {
      this.block.emit({ senderId: this.senderId(), blocked: !this.isBlocked() });
      this.close();
    }
  }

  onRightClick(event: MouseEvent): void {
    event.preventDefault();
    if (this.disabled()) {
      return;
    }
    this.position.set({ x: event.clientX, y: event.clientY });
    this.showMenu.set(true);
  }

  onTouchStart(event: TouchEvent): void {
    if (this.disabled()) {
      return;
    }
    this.clearLongPressTimer();
    const touch = event.touches[0];
    if (touch) {
      this.longPressTimer = setTimeout(() => {
        this.position.set({ x: touch.clientX, y: touch.clientY });
        this.showMenu.set(true);
        this.longPressTimer = null;
      }, this.longPressDuration());
    }
  }

  onTouchMove(): void {
    this.clearLongPressTimer();
  }

  onTouchEnd(): void {
    this.clearLongPressTimer();
  }

  onDocumentClick(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement?.contains(event.target);
    if (!clickedInside) {
      this.close();
    }
  }

  onEscape(): void {
    this.close();
  }

  onResize(): void {
    this.close();
  }

  onScroll(): void {
    this.close();
  }

  close(): void {
    this.showMenu.set(false);
    this.clearLongPressTimer();
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private buildContextUrl(): string {
    return window.location.href;
  }
}
