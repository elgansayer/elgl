import { Component, computed, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';

export interface AgeRange {
  min: number;
  max: number;
}

@Component({
  selector: 'app-age-range-slider',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="flex flex-col">
      <label class="text-sm text-on-surface-variant pb-1" for="age-range-min">
        {{ 'age_range' | t }}
        <span class="ps-1">({{ minAge() }} – {{ maxAge() }})</span>
      </label>
      <div class="relative h-8">
        <!-- min thumb -->
        <input
          id="age-range-min"
          type="range"
          [min]="minLimit()"
          [max]="maxLimit()"
          [value]="minAge()"
          (input)="onMinChange($event)"
          step="1"
          class="absolute inset-0 w-full h-full z-10 appearance-none bg-transparent cursor-pointer"
          aria-label="{{ 'age_min' | t }}"
        />
        <!-- max thumb -->
        <input
          type="range"
          [min]="minLimit()"
          [max]="maxLimit()"
          [value]="maxAge()"
          (input)="onMaxChange($event)"
          step="1"
          class="absolute inset-0 w-full h-full z-20 appearance-none bg-transparent cursor-pointer"
          aria-label="{{ 'age_max' | t }}"
        />
        <!-- visual bar -->
        <div class="absolute bottom-1 w-full h-2 bg-surface-container pointer-events-none">
          <div
            class="h-full bg-primary pointer-events-none"
            [style.left.%]="minPercent()"
            [style.width.%]="barWidth()"
          ></div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      input[type='range'] {
        pointer-events: none;
        -webkit-appearance: none;
        appearance: none;
      }
      input[type='range']::-webkit-slider-thumb {
        pointer-events: auto;
        -webkit-appearance: none;
        appearance: none;
        height: 22px;
        width: 22px;
        border-radius: 50%;
        background: var(--color-primary);
        cursor: pointer;
        border: 2px solid var(--color-surface);
      }
      input[type='range']::-moz-range-thumb {
        pointer-events: auto;
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
export class AgeRangeSliderComponent {
  /** Minimum allowed age */
  minLimit = input(18);
  /** Maximum allowed age */
  maxLimit = input(100);
  /** Starting minimum age */
  initialMin = input<number | undefined>(undefined);
  /** Starting maximum age */
  initialMax = input<number | undefined>(undefined);

  /** Emits the current (min, max) range whenever a thumb is moved */
  ageRangeChanged = output<AgeRange>();

  protected minAge = signal(18);
  protected maxAge = signal(100);

  protected minPercent = computed(() =>
    ((this.minAge() - this.minLimit()) / (this.maxLimit() - this.minLimit())) * 100,
  );
  protected maxPercent = computed(() =>
    ((this.maxAge() - this.minLimit()) / (this.maxLimit() - this.minLimit())) * 100,
  );
  protected barWidth = computed(() => this.maxPercent() - this.minPercent());

  constructor() {
    // apply initial values once
    effect(() => {
      const initMin = this.initialMin();
      const initMax = this.initialMax();
      if (initMin !== undefined) this.minAge.set(initMin);
      if (initMax !== undefined) this.maxAge.set(initMax);
    });

    // emit changes
    effect(() => {
      this.ageRangeChanged.emit({ min: this.minAge(), max: this.maxAge() });
    });
  }

  protected onMinChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    // clamp to maxAge
    const clamped = Math.min(value, this.maxAge());
    this.minAge.set(clamped);
  }

  protected onMaxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    const clamped = Math.max(value, this.minAge());
    this.maxAge.set(clamped);
  }
}
