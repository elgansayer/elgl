import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-lightbox',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmDialogImports],
  host: {
    '(window:keydown)': 'handleKeyDown($event)',
  },
  templateUrl: './lightbox.component.html',
})
export class LightboxComponent {
  readonly images = input.required<string[]>();
  readonly initialIndex = input<number>(0);
  readonly closed = output<void>();

  readonly currentIndex = linkedSignal(() => this.initialIndex());
  readonly dialogState = computed<HlmDialogState>(() => 'open');

  private touchStartX = 0;
  private touchEndX = 0;

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') this.next();
    if (event.key === 'ArrowLeft') this.prev();
  }

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed') this.closed.emit();
  }

  next(event?: Event): void {
    event?.stopPropagation();
    const idx = this.currentIndex();
    if (idx < this.images().length - 1) {
      this.currentIndex.set(idx + 1);
    }
  }

  prev(event?: Event): void {
    event?.stopPropagation();
    const idx = this.currentIndex();
    if (idx > 0) {
      this.currentIndex.set(idx - 1);
    }
  }

  goTo(index: number, event?: Event): void {
    event?.stopPropagation();
    this.currentIndex.set(index);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        this.next();
      } else {
        this.prev();
      }
    }
  }
}
