import { Component, computed, inject } from '@angular/core';
import { FontScaleService } from '../../services/font-scale.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-font-scale-slider',
  imports: [TranslatePipe],
  template: `
    <div class="flex items-center gap-2 ps-4 text-sm" role="group" aria-label="{{ 'settings.fontScale' | t }}">
      <label for="fontScaleSlider" class="text-text-secondary whitespace-nowrap">
        {{ 'settings.fontScale' | t }}
      </label>
      <input
        id="fontScaleSlider"
        type="range"
        [min]="min"
        [max]="max"
        [step]="step"
        [value]="scale()"
        [attr.aria-valuemin]="min"
        [attr.aria-valuemax]="max"
        [attr.aria-valuenow]="scale()"
        [attr.aria-valuetext]="scalePercentLabel()"
        (input)="onInput($event)"
        class="w-24 h-1 accent-primary"
      />
      <span class="text-text-secondary w-8 text-end" aria-hidden="true">{{ scalePercentLabel() }}</span>
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
    if (!(input instanceof HTMLInputElement)) return;
    const value = Number.parseFloat(input.value);
    if (!Number.isNaN(value)) {
      this.fontScaleService.setScale(value);
    }
  }
}
