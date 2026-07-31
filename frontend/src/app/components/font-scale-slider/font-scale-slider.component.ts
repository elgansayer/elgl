import { Component, computed, inject } from '@angular/core';
import { FontScaleService } from '../../services/font-scale.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-font-scale-slider',
  imports: [TranslatePipe],
  template: `
    <div class="flex items-center gap-2 ms-4 text-sm">
      <label for="fontScaleSlider" class="text-text-secondary whitespace-nowrap">
        {{ 'settings.fontScale' | t }}
      </label>
      <input
        id="fontScaleSlider"
        type="range"
        min="0.8"
        max="1.5"
        step="0.1"
        [value]="scale()"
        [attr.aria-valuetext]="scalePercentLabel()"
        (input)="onInput($event)"
        class="w-24 h-1 accent-primary"
      />
      <span class="text-text-secondary w-8 text-end">{{ scalePercentLabel() }}</span>
    </div>
  `,
})
export class FontScaleSliderComponent {
  private fontScaleService = inject(FontScaleService);
  private i18nService = inject(I18nService);

  readonly scale = this.fontScaleService.scaleFactor;
  readonly scalePercentLabel = computed(() =>
    new Intl.NumberFormat(this.i18nService.currentLang(), {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(this.scale())
  );

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value)) {
      this.fontScaleService.setScale(value);
    }
  }
}
