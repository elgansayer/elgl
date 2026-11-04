import { afterRenderEffect, Component, ElementRef, input, output, viewChild } from '@angular/core';
import lottie, { AnimationItem } from 'lottie-web';

@Component({
  selector: 'app-lottie-player',
  template: `<div #container class="w-full h-full"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class LottiePlayerComponent {
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');

  readonly animationData = input.required<unknown>();
  readonly loop = input<boolean>(true);
  readonly autoplay = input<boolean>(true);
  readonly speed = input<number>(1);
  readonly playbackKey = input<unknown>(null);

  readonly animationComplete = output<void>();

  private animation: AnimationItem | null = null;

  constructor() {
    afterRenderEffect({
      write: (onCleanup) => {
        this.playbackKey();
        const data = this.animationData();
        if (!data) {
          this.animation = null;
          return;
        }

        try {
          const animation = lottie.loadAnimation({
            container: this.container().nativeElement,
            renderer: 'svg',
            loop: this.loop(),
            autoplay: this.autoplay(),
            animationData: data,
          });

          animation.setSpeed(this.speed());
          animation.addEventListener('complete', () => {
            this.animationComplete.emit();
          });
          this.animation = animation;

          onCleanup(() => {
            animation.destroy();
            if (this.animation === animation) {
              this.animation = null;
            }
          });
        } catch {
          this.animation = null;
          console.error('Lottie SVG animation failed to render');
        }
      },
    });
  }

  getAnimation(): AnimationItem | null {
    return this.animation;
  }
}
