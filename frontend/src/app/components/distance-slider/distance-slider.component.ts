import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-distance-slider',
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="flex flex-col w-full">
      <label
        class="text-xs font-semibold text-text-secondary whitespace-nowrap"
        for="distance-range-slider"
      >
        {{ 'discovery.radiusLabel' | t: { radius: currentDistanceKm() } }}
      </label>
      <div class="relative h-8">
        <input
          id="distance-range-slider"
          type="range"
          [min]="minKm()"
          [max]="maxKm()"
          [value]="currentDistanceKm()"
          [disabled]="disabled()"
          (input)="onChange($event)"
          step="1"
          class="w-full h-8 appearance-none bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          [style.accent-color]="'var(--color-primary)'"
          aria-valuemin="{{ minKm() }}"
          aria-valuemax="{{ maxKm() }}"
          aria-valuenow="{{ currentDistanceKm() }}"
          aria-valuetext="{{ currentDistanceKm() }} km"
        />
      </div>
    </div>
  `,
  styles: [
    `
      input[type='range'] {
        -webkit-appearance: none;
        appearance: none;
      }
      input[type='range']::-webkit-slider-runnable-track {
        height: 6px;
        border-radius: 3px;
        background: var(--color-surface-100);
      }
      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        height: 22px;
        width: 22px;
        border-radius: 50%;
        background: var(--color-primary);
        cursor: pointer;
        border: 2px solid var(--color-surface);
        margin-top: -8px;
      }
      input[type='range']::-moz-range-track {
        height: 6px;
        border-radius: 3px;
        background: var(--color-surface-100);
      }
      input[type='range']::-moz-range-thumb {
        height: 22px;
        width: 22px;
        border-radius: 50%;
        background: var(--color-primary);
        cursor: pointer;
        border: 2px solid var(--color-surface);
      }
    `,
  ],
})
export class DistanceSliderComponent {
  /** Minimum distance in km */
  minKm = input(1);
  /** Maximum distance in km */
  maxKm = input(200);
  /** Starting distance in km */
  initialDistanceKm = input<number | undefined>(undefined);
  /** Whether the slider is disabled */
  disabled = input(false);

  /** Emits new distance (km) when the thumb is moved */
  distanceChanged = output<number>();

  readonly currentDistanceKm = signal(50);

  constructor() {
    effect(() => {
      const initial = this.initialDistanceKm();
      if (initial !== undefined) this.currentDistanceKm.set(initial);
    });
  }

  protected onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const value = Number(target.value);
    const clamped = Math.max(this.minKm(), Math.min(value, this.maxKm()));
    this.currentDistanceKm.set(clamped);
    this.distanceChanged.emit(clamped);
  }
}
