import { Component, OnInit, OnDestroy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-lightbox',
  imports: [CommonModule],
  host: {
    '(window:keydown)': 'handleKeyDown($event)',
  },
  template: `
    <div
      class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center touch-none animate-fadeIn"
    >
      <!-- Header / Controls -->
      <div
        class="absolute top-0 start-0 end-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent"
      >
        <span class="text-white font-medium text-sm tracking-widest">
          {{ currentIndex + 1 }} / {{ images().length }}
        </span>
        <button
          (click)="close()"
          class="text-white/80 hover:text-white p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
          aria-label="Close lightbox"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Previous Button -->
      @if (images().length > 1) {
        <button
          (click)="prev($event)"
          class="absolute start-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/60 rounded-full transition-all z-10 hidden md:block"
          [class.opacity-0]="currentIndex === 0"
          [disabled]="currentIndex === 0"
          aria-label="Previous image"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      }

      <!-- Image Container (Swipeable area) -->
      <div
        class="w-full h-full flex items-center justify-center p-2 md:p-12"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
      >
        <img
          [src]="images()[currentIndex]"
          alt="Fullscreen moment media"
          class="max-w-full max-h-full object-contain select-none transition-transform duration-300"
        />
      </div>

      <!-- Next Button -->
      @if (images().length > 1) {
        <button
          (click)="next($event)"
          class="absolute end-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/60 rounded-full transition-all z-10 hidden md:block"
          [class.opacity-0]="currentIndex === images().length - 1"
          [disabled]="currentIndex === images().length - 1"
          aria-label="Next image"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      }
    </div>
  `,
})
export class ImageLightboxComponent implements OnInit, OnDestroy {
  images = input.required<string[]>();
  initialIndex = input(0);
  closed = output<void>();

  currentIndex = 0;
  private touchStartX = 0;
  private touchEndX = 0;

  ngOnInit() {
    this.currentIndex =
      this.initialIndex() >= 0 && this.initialIndex() < this.images().length
        ? this.initialIndex()
        : 0;
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'ArrowRight') {
      this.next();
    } else if (event.key === 'ArrowLeft') {
      this.prev();
    }
  }

  next(event?: Event) {
    event?.stopPropagation();
    if (this.currentIndex < this.images().length - 1) {
      this.currentIndex++;
    }
  }

  prev(event?: Event) {
    event?.stopPropagation();
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  close() {
    this.closed.emit();
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe() {
    const swipeThreshold = 50;
    if (this.touchEndX < this.touchStartX - swipeThreshold) {
      this.next(); // Swiped left
    }
    if (this.touchEndX > this.touchStartX + swipeThreshold) {
      this.prev(); // Swiped right
    }
  }
}
