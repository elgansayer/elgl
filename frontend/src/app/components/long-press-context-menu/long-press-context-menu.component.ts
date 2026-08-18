import { Component, computed, input, output, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-long-press-context-menu',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmDialogImports],
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

    <hlm-dialog [state]="dialogState()" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="w-full mx-auto bg-surface-200 rounded-t-sheet sm:rounded-sheet shadow-lift border border-surface-100 px-4 py-3 gap-1 sm:max-w-sm"
      >
        <button hlmBtn variant="ghost" size="touch" class="w-full justify-start" (click)="doReply()">
          {{ 'context_menu.reply' | t }}
        </button>

        <button hlmBtn variant="ghost" size="touch" class="w-full justify-start" (click)="doCopy()">
          {{ 'context_menu.copy' | t }}
        </button>

        @if (messageType() === 'text') {
          <button
            hlmBtn
            variant="ghost"
            size="touch"
            class="w-full justify-start"
            (click)="doTranslate()"
          >
            {{ 'context_menu.translate' | t }}
          </button>

          <button
            hlmBtn
            variant="ghost"
            size="touch"
            class="w-full justify-start"
            (click)="doTransliterate()"
          >
            {{ 'context_menu.transliterate' | t }}
          </button>

          <button hlmBtn variant="ghost" size="touch" class="w-full justify-start" (click)="doSpeak()">
            {{ 'context_menu.speak' | t }}
          </button>

          <button
            hlmBtn
            variant="ghost"
            size="touch"
            class="w-full justify-start"
            (click)="doCorrect()"
          >
            {{ 'context_menu.correct' | t }}
          </button>

          <button
            hlmBtn
            variant="ghost"
            size="touch"
            class="w-full justify-start"
            (click)="doRequestCorrection()"
          >
            {{ 'context_menu.requestCorrection' | t }}
          </button>
        }

        <button
          hlmBtn
          variant="ghost"
          size="touch"
          class="w-full justify-start"
          (click)="doFavourite()"
        >
          {{ 'context_menu.favourite' | t }}
        </button>

        <button
          hlmBtn
          variant="destructive"
          size="touch"
          class="w-full justify-start"
          (click)="doReport()"
        >
          {{ 'context_menu.report' | t }}
        </button>

        <button
          hlmBtn
          variant="destructive"
          size="touch"
          class="w-full justify-start"
          (click)="doBlockToggle()"
        >
          {{ (isBlocked() ? 'context_menu.unblock' : 'context_menu.block') | t }}
        </button>

        <button
          hlmBtn
          variant="secondary"
          size="touch"
          class="mt-1 w-full justify-center"
          (click)="closeMenu()"
        >
          {{ 'context_menu.cancel' | t }}
        </button>
      </hlm-dialog-content>
    </hlm-dialog>
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

  readonly reply = output<{ messageId: string }>();
  readonly copyMessage = output<{ messageId: string; content: string }>();
  readonly favourite = output<{
    messageId: string;
    content: string;
    messageType: string;
  }>();
  readonly report = output<{ messageId: string; senderId: string }>();
  readonly block = output<{ senderId: string; blocked: boolean }>();
  readonly translate = output<{ messageId: string; content: string }>();
  readonly transliterate = output<{ messageId: string; content: string }>();
  readonly speak = output<{ messageId: string; content: string }>();
  readonly correct = output<{ messageId: string; content: string }>();
  readonly requestCorrection = output<{ messageId: string; content: string }>();

  menuVisible = signal(false);
  readonly dialogState = computed<HlmDialogState>(() => (this.menuVisible() ? 'open' : 'closed'));

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

  /** The Helm dialog reports every state transition, including ones this component
   * triggered itself via closeMenu() - only react to a 'closed' we didn't
   * already cause (backdrop click, Escape), guarded by menuVisible() so a
   * self-triggered close is a harmless no-op here. */
  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.menuVisible()) {
      this.menuVisible.set(false);
    }
  }

  doReply() {
    this.reply.emit({ messageId: this.messageId() });
    this.closeMenu();
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

  doTranslate() {
    this.translate.emit({ messageId: this.messageId(), content: this.messageContent() });
    this.closeMenu();
  }

  doTransliterate() {
    this.transliterate.emit({ messageId: this.messageId(), content: this.messageContent() });
    this.closeMenu();
  }

  doSpeak() {
    this.speak.emit({ messageId: this.messageId(), content: this.messageContent() });
    this.closeMenu();
  }

  doCorrect() {
    this.correct.emit({ messageId: this.messageId(), content: this.messageContent() });
    this.closeMenu();
  }

  doRequestCorrection() {
    this.requestCorrection.emit({ messageId: this.messageId(), content: this.messageContent() });
    this.closeMenu();
  }

  doBlockToggle() {
    this.block.emit({ senderId: this.senderId(), blocked: !this.isBlocked() });
    this.closeMenu();
  }
}
