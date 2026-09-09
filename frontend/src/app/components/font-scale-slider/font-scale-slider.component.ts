import { Component, computed, inject } from '@angular/core';
import { FontScaleService } from '../../services/font-scale.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-font-scale-slider',
  imports: [TranslatePipe],
  template: `
    <div class="flex items-center gap-2 ps-4 text-sm">
      <label class="flex min-w-0 items-center gap-2 text-text-secondary">
        <span class="whitespace-nowrap">{{ 'settings.fontScale' | t }}</span>
        <input
          type="range"
          [min]="min"
          [max]="max"
          [step]="step"
          [value]="scale()"
          [attr.aria-valuetext]="scalePercentLabel()"
          (input)="onInput($event)"
          class="h-1 w-24 accent-primary"
        />
      </label>
      <span class="w-8 text-end text-text-secondary" aria-hidden="true">{{ scalePercentLabel() }}</span>
    </div>
  `,
})
export class FontScaleSliderComponent {
  private readonly fontScaleService = inject(FontScaleService);
  private readonly i18nService = inject(I18nService);

  readonly scale = this.fontScaleService.scaleFactor;
  readonly min = this.fontScaleService.min;
  readonly max = this.fontScaleService.max;
  readonly step = this.fontScaleService.step;

  readonly scalePercentLabel = computed(() =>
    new Intl.NumberFormat(this.i18nService.currentLang(), {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(this.scale())
  );

  protected onInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !Number.isFinite(input.valueAsNumber)) return;

    this.fontScaleService.setScale(input.valueAsNumber);
  }
}
