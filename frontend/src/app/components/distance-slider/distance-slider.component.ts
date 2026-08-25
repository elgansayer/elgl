import { Component, computed, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-distance-slider',
  imports: [TranslatePipe],
  template: `
    <label class="flex w-full min-w-0 flex-col gap-1.5">
      <span class="text-xs font-semibold leading-5 text-text-secondary break-words">
        {{ 'discovery.radiusLabel' | t: { radius: currentDistanceKm() } }}
      </span>
      <span class="relative flex min-h-11 items-center">
        <input
          type="range"
          [min]="effectiveMinKm()"
          [max]="effectiveMaxKm()"
          [value]="currentDistanceKm()"
          [disabled]="disabled()"
          (input)="onChange($event)"
          step="1"
          class="h-11 w-full appearance-none cursor-pointer bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
          [style.accent-color]="'var(--color-primary)'"
        />
      </span>
    </label>
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
        background: rgb(var(--surface-100-rgb));
      }
      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        height: 22px;
        width: 22px;
        border-radius: 50%;
        background: rgb(var(--color-primary-rgb));
        cursor: pointer;
        border: 2px solid rgb(var(--surface-500-rgb));
        margin-top: -8px;
      }
      input[type='range']::-moz-range-track {
        height: 6px;
        border-radius: 3px;
        background: rgb(var(--surface-100-rgb));
      }
      input[type='range']::-moz-range-thumb {
        height: 22px;
        width: 22px;
        border-radius: 50%;
        background: rgb(var(--color-primary-rgb));
        cursor: pointer;
        border: 2px solid rgb(var(--surface-500-rgb));
      }
      input[type='range']:disabled::-webkit-slider-thumb,
      input[type='range']:disabled::-moz-range-thumb {
        cursor: not-allowed;
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
  readonly effectiveMinKm = computed(() => Math.min(this.minKm(), this.maxKm()));
  readonly effectiveMaxKm = computed(() => Math.max(this.minKm(), this.maxKm()));

  constructor() {
    effect(() => {
      const initial = this.initialDistanceKm();
      const value = initial ?? this.currentDistanceKm();
      this.currentDistanceKm.set(this.clamp(value));
    });
  }

  protected onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const clamped = this.clamp(Number(target.value));
    this.currentDistanceKm.set(clamped);
    this.distanceChanged.emit(clamped);
  }

  private clamp(value: number): number {
    const min = this.effectiveMinKm();
    const max = this.effectiveMaxKm();
    const finiteValue = Number.isFinite(value) ? value : min;
    return Math.max(min, Math.min(finiteValue, max));
  }
}
