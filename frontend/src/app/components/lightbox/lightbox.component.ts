import { Component, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lightbox',
  standalone: true,
  imports: [CommonModule],
  host: {
    '(window:keydown)': 'handleKeyDown($event)'
  },
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
         (touchstart)="onTouchStart($event)"
         (touchend)="onTouchEnd($event)">
      
      <!-- Close Button -->
      <button (click)="closed.emit()" 
              class="absolute top-4 right-4 z-[110] p-2 text-white/70 hover:text-white bg-black/50 rounded-full transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Image Container -->
      <div class="relative w-full h-full flex items-center justify-center overflow-hidden">
        @for (img of images(); track img; let i = $index) {
          <img [src]="img" 
               [class.opacity-100]="i === currentIndex()"
               [class.opacity-0]="i !== currentIndex()"
               [class.scale-100]="i === currentIndex()"
               [class.scale-95]="i !== currentIndex()"
               [class.pointer-events-none]="i !== currentIndex()"
               class="absolute max-w-full max-h-full object-contain transition-all duration-300 ease-out select-none"
               alt="Moment media" />
        }
      </div>

      <!-- Navigation Arrows (Desktop) -->
      @if (images().length > 1) {
        <button (click)="prev($event)" 
                [class.invisible]="currentIndex() === 0"
                class="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/50 rounded-full hidden md:block transition-colors z-[110]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        
        <button (click)="next($event)" 
                [class.invisible]="currentIndex() === images().length - 1"
                class="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/50 rounded-full hidden md:block transition-colors z-[110]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <!-- Indicators -->
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-[110]">
          @for (img of images(); track img; let i = $index) {
            <button (click)="goTo(i, $event)"
                    [class.bg-white]="i === currentIndex()"
                    [class.bg-white/30]="i !== currentIndex()"
                    class="w-2 h-2 rounded-full transition-colors duration-200">
              <span class="sr-only">Image {{ i + 1 }}</span>
            </button>
          }
        </div>
      }
    </div>
  `
})
export class LightboxComponent implements OnInit {
  images = input.required<string[]>();
  initialIndex = input<number>(0);
  closed = output<void>();

  currentIndex = signal<number>(0);

  private touchStartX = 0;
  private touchEndX = 0;

  ngOnInit() {
    this.currentIndex.set(this.initialIndex());
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') this.closed.emit();
    if (event.key === 'ArrowRight') this.next();
    if (event.key === 'ArrowLeft') this.prev();
  }

  next(event?: Event) {
    event?.stopPropagation();
    if (this.currentIndex() < this.images().length - 1) {
      this.currentIndex.update(i => i + 1);
    }
  }

  prev(event?: Event) {
    event?.stopPropagation();
    if (this.currentIndex() > 0) {
      this.currentIndex.update(i => i - 1);
    }
  }

  goTo(index: number, event?: Event) {
    event?.stopPropagation();
    this.currentIndex.set(index);
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
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        this.next(); // Swiped left
      } else {
        this.prev(); // Swiped right
      }
    }
  }
}
