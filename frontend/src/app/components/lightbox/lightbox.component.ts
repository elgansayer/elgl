import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
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
  private readonly SWIPE_THRESHOLD_PX = 48;
  private readonly HORIZONTAL_INTENT_RATIO = 1.2;

  readonly images = input.required<string[]>();
  readonly initialIndex = input<number>(0);
  readonly closed = output<void>();

  readonly currentIndex = linkedSignal(() => this.normaliseIndex(this.initialIndex()));
  readonly dialogState = computed<HlmDialogState>(() => 'open');
  readonly hasPrevious = computed(() => this.currentIndex() > 0);
  readonly hasNext = computed(() => this.currentIndex() < this.images().length - 1);

  private readonly loadedImages = signal<ReadonlySet<string>>(new Set());
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());

  private activePointerId: number | null = null;
  private pointerStartX = 0;
  private pointerStartY = 0;

  handleKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;

    if (event.key === 'ArrowRight' && this.hasNext()) {
      event.preventDefault();
      this.next();
      return;
    }

    if (event.key === 'ArrowLeft' && this.hasPrevious()) {
      event.preventDefault();
      this.prev();
      return;
    }

    if (event.key === 'Home' && this.currentIndex() !== 0) {
      event.preventDefault();
      this.goTo(0);
      return;
    }

    if (event.key === 'End' && this.images().length > 0) {
      const lastIndex = this.images().length - 1;
      if (this.currentIndex() !== lastIndex) {
        event.preventDefault();
        this.goTo(lastIndex);
      }
    }
  }

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed') this.closed.emit();
  }

  next(event?: Event): void {
    event?.stopPropagation();
    if (this.hasNext()) {
      this.currentIndex.update((index) => index + 1);
    }
  }

  prev(event?: Event): void {
    event?.stopPropagation();
    if (this.hasPrevious()) {
      this.currentIndex.update((index) => index - 1);
    }
  }

  goTo(index: number, event?: Event): void {
    event?.stopPropagation();
    this.currentIndex.set(this.normaliseIndex(index));
  }

  onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary || event.pointerType === 'mouse') return;

    this.activePointerId = event.pointerId;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
  }

  onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;

    const deltaX = event.clientX - this.pointerStartX;
    const deltaY = event.clientY - this.pointerStartY;
    this.resetPointerGesture();

    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);
    const isHorizontalSwipe =
      horizontalDistance >= this.SWIPE_THRESHOLD_PX &&
      horizontalDistance > verticalDistance * this.HORIZONTAL_INTENT_RATIO;

    if (!isHorizontalSwipe) return;

    event.preventDefault();
    if (deltaX < 0) {
      this.next();
    } else {
      this.prev();
    }
  }

  onPointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.activePointerId) {
      this.resetPointerGesture();
    }
  }

  onImageLoad(url: string): void {
    this.loadedImages.update((images) => {
      const next = new Set(images);
      next.add(url);
      return next;
    });
    this.failedImages.update((images) => {
      if (!images.has(url)) return images;
      const next = new Set(images);
      next.delete(url);
      return next;
    });
  }

  onImageError(url: string): void {
    this.failedImages.update((images) => {
      const next = new Set(images);
      next.add(url);
      return next;
    });
    this.loadedImages.update((images) => {
      if (!images.has(url)) return images;
      const next = new Set(images);
      next.delete(url);
      return next;
    });
  }

  isImageLoaded(url: string): boolean {
    return this.loadedImages().has(url);
  }

  isImageFailed(url: string): boolean {
    return this.failedImages().has(url);
  }

  private normaliseIndex(index: number): number {
    const imageCount = this.images().length;
    if (imageCount === 0 || !Number.isFinite(index)) return 0;
    return Math.min(Math.max(Math.trunc(index), 0), imageCount - 1);
  }

  private resetPointerGesture(): void {
    this.activePointerId = null;
    this.pointerStartX = 0;
    this.pointerStartY = 0;
  }
}
