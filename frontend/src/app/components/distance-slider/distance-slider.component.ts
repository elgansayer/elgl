import { Component, computed, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-distance-slider',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="flex flex-col">
      <label class="text-xs font-semibold text-text-secondary pb-1" for="distance-slider-input">
        {{ 'discovery.distanceSliderLabel' | t }}
        <span class="ps-1 text-accent-500">({{ currentDistance() }} km)</span>
      </label>
      <div class="relative h-8">
        <input
          id="distance-slider-input"
          type="range"
          [min]="minKm()"
          [max]="maxKm()"
          [value]="currentDistance()"
          (input)="onChange($event)"
          [step]="step()"
          class="absolute inset-0 w-full h-full z-10 appearance-none bg-transparent cursor-pointer"
          aria-label="{{ 'discovery.distanceSliderAria' | t }}"
        />
        <div class="absolute bottom-1 w-full h-2 bg-surface-container pointer-events-none rounded-full">
          <div
            class="h-full bg-accent-500 pointer-events-none rounded-full"
            [style.width.%]="fillPercent()"
          ></div>
        </div>
        <div class="absolute bottom-[-14px] start-0 text-[9px] text-text-muted pointer-events-none">{{ minKm() }} km</div>
        <div class="absolute bottom-[-14px] end-0 text-[9px] text-text-muted pointer-events-none">{{ maxKm() }} km</div>
      </div>
    </div>
  `,
  styles: [
    `
      input[type='range'] {
        -webkit-appearance: none;
        appearance: none;
      }
      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        height: 22px;
        width: 22px;
        border-radius: 50%;
        background: var(--color-accent);
        cursor: pointer;
        border: 2px solid var(--color-surface);
      }
      input[type='range']::-moz-range-thumb {
        height: 22px;
        width: 22px;
        border-radius: 50%;
        background: var(--color-accent);
        cursor: pointer;
        border: 2px solid var(--color-surface);
      }
    `,
  ],
})
export class DistanceSliderComponent {
  minKm = input(1);
  maxKm = input(250);
  initialDistance = input(50);
  step = input(1);

  distanceChanged = output<number>();

  protected currentDistance = signal(50);

  protected fillPercent = computed(() =>
    ((this.currentDistance() - this.minKm()) / (this.maxKm() - this.minKm())) * 100,
  );

  constructor() {
    effect(() => {
      const init = this.initialDistance();
      if (init !== undefined) this.currentDistance.set(init);
    });

    effect(() => {
      this.distanceChanged.emit(this.currentDistance());
    });
  }

  protected onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const value = Number(target.value);
    const clamped = Math.min(Math.max(value, this.minKm()), this.maxKm());
    this.currentDistance.set(clamped);
  }
}