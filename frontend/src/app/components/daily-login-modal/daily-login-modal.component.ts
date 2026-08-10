import {
  Component,
  input,
  output,
  effect,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-daily-login-modal',
  imports: [TranslatePipe],
  template: `
    <div
      #overlay
      class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="dialogTitleId"
      tabindex="-1"
      (click)="onBackdropClick($event)"
    >
      <div
        class="bg-surface-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-sm w-full shadow-2xl border border-surface-100 text-center space-y-3 sm:space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div class="text-6xl mb-2" aria-hidden="true">🎁</div>
        <h3 [id]="dialogTitleId" class="text-2xl font-black text-text-primary">
          {{ 'dailyLoginModal.title' | t }}
        </h3>
        <p class="text-text-secondary" aria-live="polite">
          {{ 'dailyLoginModal.body' | t: { coins: coins() } }}
        </p>
        <button
          #primaryButton
          (click)="closed.emit()"
          class="w-full py-3 mt-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-extrabold shadow transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
          [attr.aria-label]="
            ('dailyLoginModal.cta' | t) + ', ' + ('dailyLoginModal.body' | t: { coins: coins() })
          "
        >
          {{ 'dailyLoginModal.cta' | t }}
        </button>
      </div>
    </div>
  `,
  host: {
    '(document:keydown.escape)': 'onEscapeKey()',
  },
})
export class DailyLoginModalComponent {
  coins = input(0);
  closed = output<void>();

  readonly dialogTitleId = 'daily-login-title-' + Math.random().toString(36).substring(2, 9);
  private readonly primaryButton = viewChild<ElementRef<HTMLElement>>('primaryButton');
  private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');

  constructor() {
    effect(() => {
      if (this.coins()) {
        setTimeout(() => {
          const btn = this.primaryButton();
          if (btn?.nativeElement) {
            btn.nativeElement.focus();
          }
        });
      }
    });

    afterNextRender(() => {
      setTimeout(() => {
        const el = this.overlay();
        if (el?.nativeElement) {
          el.nativeElement.focus();
        }
      });
    });
  }

  protected onEscapeKey(): void {
    this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains('animate-fadeIn')) {
      this.closed.emit();
    }
  }
}
