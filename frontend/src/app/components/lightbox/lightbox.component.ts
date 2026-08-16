import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, linkedSignal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-lightbox',
  imports: [HlmButton, TranslatePipe],
  host: {
    '(window:keydown)': 'handleKeyDown($event)',
  },
  templateUrl: './lightbox.component.html',
})
export class LightboxComponent {
  images = input.required<string[]>();
  initialIndex = input<number>(0);
  closed = output<void>();

  currentIndex = linkedSignal(() => this.initialIndex());

  private touchStartX = 0;
  private touchEndX = 0;

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.closed.emit();
    if (event.key === 'ArrowRight') this.next();
    if (event.key === 'ArrowLeft') this.prev();
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