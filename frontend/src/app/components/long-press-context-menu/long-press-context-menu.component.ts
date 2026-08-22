import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { TranslatePipe } from '../../services/translate.pipe';
import { NlpRequestError, NlpService } from '../../services/nlp.service';

interface ExplainGrammarContext {
  messageId: string;
  original: string;
  corrected: string;
}

interface SimplificationContext {
  messageId: string;
  text: string;
}

type NlpDialogError = 'rate_limit' | 'empty' | 'auth' | 'request';

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

@Component({
  selector: 'app-long-press-context-menu',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <div
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd($event)"
      (touchcancel)="onTouchCancel()"
      (mousedown)="onMouseDown($event)"
      (mouseup)="onMouseUp()"
      (mouseleave)="onMouseCancel()"
      (contextmenu)="onContextMenu($event)"
      style="display: contents"
    >
      <ng-content />
    </div>

    <button
      hlmBtn
      type="button"
      variant="secondary"
      size="sm"
      class="message-actions-trigger sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[9999] focus:ring-2 focus:ring-primary focus:ring-offset-2"
      aria-haspopup="dialog"
      [attr.aria-expanded]="menuVisible()"
      (click)="openMenu()"
    >
      {{ 'context_menu.open' | t }}
    </button>

    <hlm-dialog [state]="dialogState()" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="w-full mx-auto bg-surface-200 rounded-t-sheet sm:rounded-sheet shadow-lift border border-surface-100 px-4 py-3 gap-1 sm:max-w-sm"
      >
        <button
          hlmBtn
          variant="ghost"
          size="touch"
          class="w-full justify-start"
          (click)="doReply()"
        >
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
            (click)="openSimplification()"
          >
            {{ 'chatRoom.simplifyBtn' | t }}
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

          <button
            hlmBtn
            variant="ghost"
            size="touch"
            class="w-full justify-start"
            (click)="doSpeak()"
          >
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

        @if (canExplainCorrection()) {
          <button
            hlmBtn
            variant="ghost"
            size="touch"
            class="w-full justify-start"
            (click)="openExplanation()"
          >
            {{ 'moments.explanation' | t }}
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

    <hlm-dialog
      [state]="simplificationDialogState()"
      (stateChanged)="onSimplificationDialogStateChanged($event)"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="w-full max-w-lg bg-surface-200 rounded-sheet shadow-lift border border-surface-100 p-5"
      >
        <hlm-dialog-header>
          <h2 hlmDialogTitle>{{ 'chatRoom.simplifiedTitle' | t }}</h2>
        </hlm-dialog-header>

        @if (simplificationSource(); as source) {
          <div class="space-y-3 text-sm">
            <div>
              <p class="font-semibold text-text-secondary">{{ 'moments.originalSentence' | t }}</p>
              <p class="mt-1 whitespace-pre-wrap text-text-primary">{{ source.text }}</p>
            </div>
          </div>
        }

        @if (simplificationLoading()) {
          <p role="status" aria-live="polite" class="py-4 text-sm text-text-secondary">
            {{ 'chatRoom.simplifying' | t }}
          </p>
        } @else if (simplificationError()) {
          <div
            role="alert"
            class="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
            [attr.data-error-kind]="simplificationError()"
          >
            @switch (simplificationError()) {
              @case ('rate_limit') {
                {{ 'chatRoom.simplifyErrorRateLimit' | t }}
              }
              @case ('auth') {
                {{ 'chatRoom.simplifyErrorAuth' | t }}
              }
              @case ('empty') {
                {{ 'chatRoom.simplifyErrorEmpty' | t }}
              }
              @default {
                {{ 'chatRoom.simplifyErrorRequest' | t }}
              }
            }
          </div>
        } @else if (simplificationText(); as simplified) {
          <p
            class="whitespace-pre-wrap text-sm leading-relaxed text-text-primary"
            aria-live="polite"
          >
            {{ simplified }}
          </p>
        }

        <hlm-dialog-footer class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          @if (simplificationError()) {
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="touch"
              [disabled]="simplificationLoading()"
              (click)="retrySimplification()"
            >
              {{ 'common.retry' | t }}
            </button>
          }
          <button hlmBtn type="button" size="touch" (click)="closeSimplification()">
            {{ 'common.close' | t }}
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>

    <hlm-dialog
      [state]="explanationDialogState()"
      (stateChanged)="onExplanationDialogStateChanged($event)"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="w-full max-w-lg bg-surface-200 rounded-sheet shadow-lift border border-surface-100 p-5"
      >
        <hlm-dialog-header>
          <h2 hlmDialogTitle>{{ 'moments.explanation' | t }}</h2>
          <p hlmDialogDescription>{{ 'correction.explainPlaceholder' | t }}</p>
        </hlm-dialog-header>

        @if (explanationSource(); as source) {
          <div class="space-y-3 text-sm">
            <div>
              <p class="font-semibold text-text-secondary">{{ 'moments.originalSentence' | t }}</p>
              <p class="mt-1 whitespace-pre-wrap text-text-primary">{{ source.original }}</p>
            </div>
            <div>
              <p class="font-semibold text-text-secondary">{{ 'moments.correctedSentence' | t }}</p>
              <p class="mt-1 whitespace-pre-wrap text-text-primary">{{ source.corrected }}</p>
            </div>
          </div>
        }

        @if (explanationLoading()) {
          <p role="status" aria-live="polite" class="py-4 text-sm text-text-secondary">
            {{ 'common.loading' | t }}
          </p>
        } @else if (explanationError()) {
          <div
            role="alert"
            class="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
            [attr.data-error-kind]="explanationError()"
          >
            {{ 'common.error_generic' | t }}
          </div>
        } @else if (explanationText(); as explanation) {
          <p
            class="whitespace-pre-wrap text-sm leading-relaxed text-text-primary"
            aria-live="polite"
          >
            {{ explanation }}
          </p>
        }

        <hlm-dialog-footer class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          @if (explanationError()) {
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="touch"
              [disabled]="explanationLoading()"
              (click)="retryExplanation()"
            >
              {{ 'common.retry' | t }}
            </button>
          }
          <button hlmBtn type="button" size="touch" (click)="closeExplanation()">
            {{ 'common.close' | t }}
          </button>
        </hlm-dialog-footer>
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
  readonly correctionOriginal = input<string | null>(null);
  readonly correctionCorrected = input<string | null>(null);
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

  readonly menuVisible = signal(false);
  readonly dialogState = computed<HlmDialogState>(() => (this.menuVisible() ? 'open' : 'closed'));
  readonly canExplainCorrection = computed(() => {
    return (
      this.messageType() === 'correction' &&
      Boolean(this.correctionOriginal()?.trim()) &&
      Boolean(this.correctionCorrected()?.trim())
    );
  });

  readonly simplificationOpen = signal(false);
  readonly simplificationLoading = signal(false);
  readonly simplificationText = signal<string | null>(null);
  readonly simplificationError = signal<NlpDialogError | null>(null);
  readonly simplificationSource = signal<SimplificationContext | null>(null);
  readonly simplificationDialogState = computed<HlmDialogState>(() =>
    this.simplificationOpen() ? 'open' : 'closed',
  );

  readonly explanationOpen = signal(false);
  readonly explanationLoading = signal(false);
  readonly explanationText = signal<string | null>(null);
  readonly explanationError = signal<NlpDialogError | null>(null);
  readonly explanationSource = signal<ExplainGrammarContext | null>(null);
  readonly explanationDialogState = computed<HlmDialogState>(() =>
    this.explanationOpen() ? 'open' : 'closed',
  );

  private readonly nlpService = inject(NlpService);
  private readonly destroyRef = inject(DestroyRef);
  private longPressTimer?: ReturnType<typeof setTimeout>;
  private readonly LONG_PRESS_DURATION = 600;
  private readonly SWIPE_REPLY_THRESHOLD_PX = 56;
  private readonly SWIPE_VERTICAL_TOLERANCE_PX = 48;
  private readonly GESTURE_MOVE_TOLERANCE_PX = 10;
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  private touchSwipeCancelled = false;
  private simplificationController?: AbortController;
  private simplificationRequestId = 0;
  private explanationController?: AbortController;
  private explanationRequestId = 0;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.resetTouchGesture();
      this.simplificationController?.abort();
      this.explanationController?.abort();
      this.simplificationController = undefined;
      this.explanationController = undefined;
      this.simplificationRequestId += 1;
      this.explanationRequestId += 1;
    });
  }

  onTouchStart(event: TouchEvent): void {
    this.resetTouchGesture();
    if (event.touches.length !== 1) return;

    const touch = event.touches.item(0);
    if (!touch) return;

    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.startTimer();
  }

  onTouchMove(event: TouchEvent): void {
    if (this.touchStartX === null || this.touchStartY === null) return;
    if (event.touches.length !== 1) {
      this.touchSwipeCancelled = true;
      this.cancelTimer();
      return;
    }

    const touch = event.touches.item(0);
    if (!touch) return;

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (
      horizontalDistance >= this.GESTURE_MOVE_TOLERANCE_PX ||
      verticalDistance >= this.GESTURE_MOVE_TOLERANCE_PX
    ) {
      this.cancelTimer();
    }

    if (
      verticalDistance > this.SWIPE_VERTICAL_TOLERANCE_PX ||
      verticalDistance > horizontalDistance
    ) {
      this.touchSwipeCancelled = true;
    }
  }

  onTouchEnd(event?: TouchEvent): void {
    this.cancelTimer();

    const startX = this.touchStartX;
    const startY = this.touchStartY;
    const touch = event?.changedTouches.item(0) ?? null;
    const cancelled = this.touchSwipeCancelled;
    this.resetTouchGesture();

    if (startX === null || startY === null || !touch || cancelled) return;

    const horizontalDistance = Math.abs(touch.clientX - startX);
    const verticalDistance = Math.abs(touch.clientY - startY);
    if (
      horizontalDistance < this.SWIPE_REPLY_THRESHOLD_PX ||
      verticalDistance > this.SWIPE_VERTICAL_TOLERANCE_PX ||
      horizontalDistance <= verticalDistance
    ) {
      return;
    }

    if (event?.cancelable) event.preventDefault();
    this.reply.emit({ messageId: this.messageId() });
  }

  onTouchCancel(): void {
    this.resetTouchGesture();
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

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.openMenu();
  }

  openMenu(): void {
    this.cancelTimer();
    this.menuVisible.set(true);
  }

  private startTimer() {
    this.cancelTimer();
    this.longPressTimer = setTimeout(() => {
      this.openMenu();
    }, this.LONG_PRESS_DURATION);
  }

  private cancelTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = undefined;
    }
  }

  private resetTouchGesture(): void {
    this.cancelTimer();
    this.touchStartX = null;
    this.touchStartY = null;
    this.touchSwipeCancelled = false;
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

  openSimplification(): void {
    const text = this.messageContent().trim();
    if (this.messageType() !== 'text' || !text || this.simplificationLoading()) return;

    this.closeMenu();
    this.simplificationSource.set({ messageId: this.messageId(), text });
    this.simplificationText.set(null);
    this.simplificationError.set(null);
    this.simplificationOpen.set(true);
    void this.loadSimplification();
  }

  retrySimplification(): void {
    if (this.simplificationLoading() || !this.simplificationSource()) return;
    void this.loadSimplification();
  }

  closeSimplification(): void {
    this.simplificationController?.abort();
    this.simplificationController = undefined;
    this.simplificationRequestId += 1;
    this.simplificationOpen.set(false);
    this.simplificationLoading.set(false);
  }

  onSimplificationDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.simplificationOpen()) {
      this.closeSimplification();
    }
  }

  private async loadSimplification(): Promise<void> {
    const source = this.simplificationSource();
    if (!source || this.simplificationLoading()) return;

    this.simplificationController?.abort();
    const controller = new AbortController();
    this.simplificationController = controller;
    const requestId = ++this.simplificationRequestId;
    this.simplificationLoading.set(true);
    this.simplificationText.set(null);
    this.simplificationError.set(null);

    try {
      const result = await this.nlpService.simplifyText({ text: source.text }, controller.signal);
      if (!this.isCurrentSimplificationRequest(requestId, source)) return;
      this.simplificationText.set(result.simplified);
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      if (!this.isCurrentSimplificationRequest(requestId, source)) return;
      if (error instanceof NlpRequestError) {
        this.simplificationError.set(error.kind);
      } else {
        this.simplificationError.set('request');
      }
    } finally {
      if (requestId === this.simplificationRequestId) {
        this.simplificationLoading.set(false);
      }
    }
  }

  private isCurrentSimplificationRequest(
    requestId: number,
    source: SimplificationContext,
  ): boolean {
    return (
      requestId === this.simplificationRequestId &&
      this.simplificationOpen() &&
      this.messageId() === source.messageId &&
      this.messageContent().trim() === source.text
    );
  }

  openExplanation(): void {
    const original = this.correctionOriginal()?.trim();
    const corrected = this.correctionCorrected()?.trim();
    if (!this.canExplainCorrection() || !original || !corrected) return;

    this.closeMenu();
    this.explanationSource.set({ messageId: this.messageId(), original, corrected });
    this.explanationText.set(null);
    this.explanationError.set(null);
    this.explanationOpen.set(true);
    void this.loadExplanation();
  }

  retryExplanation(): void {
    if (this.explanationLoading() || !this.explanationSource()) return;
    void this.loadExplanation();
  }

  closeExplanation(): void {
    this.explanationController?.abort();
    this.explanationController = undefined;
    this.explanationRequestId += 1;
    this.explanationOpen.set(false);
    this.explanationLoading.set(false);
  }

  onExplanationDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.explanationOpen()) {
      this.closeExplanation();
    }
  }

  private async loadExplanation(): Promise<void> {
    const source = this.explanationSource();
    if (!source || this.explanationLoading()) return;

    this.explanationController?.abort();
    const controller = new AbortController();
    this.explanationController = controller;
    const requestId = ++this.explanationRequestId;
    this.explanationLoading.set(true);
    this.explanationText.set(null);
    this.explanationError.set(null);

    try {
      const result = await this.nlpService.explainGrammar(
        { original: source.original, corrected: source.corrected },
        controller.signal,
      );
      if (!this.isCurrentExplanationRequest(requestId, source)) return;
      this.explanationText.set(result.explanation);
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      if (!this.isCurrentExplanationRequest(requestId, source)) return;
      if (error instanceof NlpRequestError) {
        this.explanationError.set(error.kind);
      } else {
        this.explanationError.set('request');
      }
    } finally {
      if (requestId === this.explanationRequestId) {
        this.explanationLoading.set(false);
      }
    }
  }

  private isCurrentExplanationRequest(requestId: number, source: ExplainGrammarContext): boolean {
    return (
      requestId === this.explanationRequestId &&
      this.explanationOpen() &&
      this.messageId() === source.messageId &&
      this.correctionOriginal()?.trim() === source.original &&
      this.correctionCorrected()?.trim() === source.corrected
    );
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
