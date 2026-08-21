import {
  Component,
  input,
  inject,
  DestroyRef,
  ElementRef,
  output,
  afterNextRender,
} from '@angular/core';
import lottie, { AnimationItem } from 'lottie-web';

@Component({
  selector: 'app-lottie-player',
  template: `<div class="w-full h-full"></div>`,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class LottiePlayerComponent {
  private readonly elRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  animationData = input.required<unknown>();
  loop = input<boolean>(true);
  autoplay = input<boolean>(true);
  speed = input<number>(1);

  animationComplete = output<void>();

  private animation: AnimationItem | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.destroyAnimation());

    afterNextRender({
      read: () => {
        this.loadAnimation();
      },
    });
  }

  getAnimation(): AnimationItem | null {
    return this.animation;
  }

  private loadAnimation(): void {
    this.destroyAnimation();

    const el = this.elRef.nativeElement.querySelector('div');
    const data = this.animationData();
    if (!el || !data) return;

    this.animation = lottie.loadAnimation({
      container: el as Element,
      renderer: 'svg',
      loop: this.loop(),
      autoplay: this.autoplay(),
      animationData: data,
    });

    this.animation.setSpeed(this.speed());

    this.animation.addEventListener('complete', () => {
      this.animationComplete.emit();
    });
  }

  private destroyAnimation(): void {
    if (this.animation) {
      this.animation.destroy();
      this.animation = null;
    }
  }
}