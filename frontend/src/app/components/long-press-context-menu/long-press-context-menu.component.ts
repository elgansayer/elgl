import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { TranslatePipe } from '../../services/translate.pipe';
import { NlpRequestError, NlpService } from '../../services/nlp.service';

interface ExplainGrammarContext {
  messageId: string;
  original: string;
  corrected: string;
}

type ExplanationError = 'rate_limit' | 'empty' | 'auth' | 'request';

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
          <p class="whitespace-pre-wrap text-sm leading-relaxed text-text-primary" aria-live="polite">
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

  readonly explanationOpen = signal(false);
  readonly explanationLoading = signal(false);
  readonly explanationText = signal<string | null>(null);
  readonly explanationError = signal<ExplanationError | null>(null);
  readonly explanationSource = signal<ExplainGrammarContext | null>(null);
  readonly explanationDialogState = computed<HlmDialogState>(() =>
    this.explanationOpen() ? 'open' : 'closed',
  );

  private readonly nlpService = inject(NlpService);
  private longPressTimer?: ReturnType<typeof setTimeout>;
  private readonly LONG_PRESS_DURATION = 600;
  private explanationController?: AbortController;
  private explanationRequestId = 0;

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
      if ((error as { name?: string } | null)?.name === 'AbortError') return;
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
