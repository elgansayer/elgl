import {Component, input, output, signal} from '@angular/core';import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-long-press-context-menu',
  imports: [TranslatePipe],
  template: `
    <div
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd()"
      (touchcancel)="onTouchCancel()"
      (mousedown)="onMouseDown($event)"
      (mouseup)="onMouseUp()"
      (mouseleave)="onMouseCancel()"
      style="display: contents"
    >
      <ng-content />
    </div>

    @if (menuVisible()) {
      <div
        class="fixed inset-0 z-50 flex items-end justify-center pb-8"
        tabindex="0"
        (keydown.enter)="$event.preventDefault(); closeMenu()"
        (click)="closeMenu()"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="bg-surface-800 rounded-2xl shadow-2xl px-6 py-4 space-y-2"
          tabindex="0"
          (keydown.enter)="$event.preventDefault(); $event.stopPropagation()"
          (click)="$event.stopPropagation()"
        >
          <button
            class="w-full text-start text-white font-medium py-2 px-3 rounded-lg hover:bg-white/10"
            (click)="doCopy()"
          >
            {{ 'context_menu.copy' | t }}
          </button>

          <button
            class="w-full text-start text-white font-medium py-2 px-3 rounded-lg hover:bg-white/10"
            (click)="doFavourite()"
          >
            {{ 'context_menu.favourite' | t }}
          </button>

          <button
            class="w-full text-start text-red-400 font-medium py-2 px-3 rounded-lg hover:bg-white/10"
            (click)="doReport()"
          >
            {{ 'context_menu.report' | t }}
          </button>

          <button
            class="w-full text-start text-red-400 font-medium py-2 px-3 rounded-lg hover:bg-white/10"
            (click)="doBlockToggle()"
          >
            {{ (isBlocked() ? 'context_menu.unblock' : 'context_menu.block') | t }}
          </button>

          <button
            class="w-full text-center text-neutral-400 py-2 px-3 rounded-lg hover:bg-white/10 mt-1"
            (click)="closeMenu()"
          >
            {{ 'context_menu.cancel' | t }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class LongPressContextMenuComponent {
  readonly messageId = input.required<string>();
  readonly messageContent = input<string>('');
  readonly messageType = input<string>('text');
  readonly senderId = input.required<string>();
  readonly roomId = input.required<string>();
  readonly isBlocked = input(false);

  readonly copyMessage = output<{ messageId: string; content: string }>();
  readonly favourite = output<{
    messageId: string;
    content: string;
    messageType: string;
  }>();
  readonly report = output<{ messageId: string; senderId: string }>();
  readonly block = output<{ senderId: string; blocked: boolean }>();

  menuVisible = signal(false);

  private longPressTimer?: ReturnType<typeof setTimeout>;
  private readonly LONG_PRESS_DURATION = 600;

  onTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    this.startTimer();
  }

  onTouchEnd() {
    this.cancelTimer();
  }

  onTouchCancel() {
    this.cancelTimer();
  }

  onMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    this.startTimer();
  }

  onMouseUp() {
    this.cancelTimer();
  }

  onMouseCancel() {
    this.cancelTimer();
  }

  private startTimer() {
    this.cancelTimer();
    this.longPressTimer = setTimeout(() => {
      this.menuVisible.set(true);
    }, this.LONG_PRESS_DURATION);
  }

  private cancelTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = undefined;
    }
  }

  closeMenu() {
    this.menuVisible.set(false);
  }

  doCopy() {
    this.copyMessage.emit({ messageId: this.messageId(), content: this.messageContent() });
    this.closeMenu();
  }

  doFavourite() {
    this.favourite.emit({
      messageId: this.messageId(),
      content: this.messageContent(),
      messageType: this.messageType(),
    });
    this.closeMenu();
  }

  doReport() {
    this.report.emit({ messageId: this.messageId(), senderId: this.senderId() });
    this.closeMenu();
  }

  doBlockToggle() {
    this.block.emit({ senderId: this.senderId(), blocked: !this.isBlocked() });
    this.closeMenu();
  }
}
