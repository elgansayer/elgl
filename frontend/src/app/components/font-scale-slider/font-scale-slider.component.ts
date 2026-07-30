import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontScaleService } from '../../services/font-scale.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-font-scale-slider',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
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
        (input)="onInput($event)"
        class="w-24 h-1 accent-primary"
      />
      <span class="text-text-secondary w-8 text-end">{{ scale() | percent:'1.0-0' }}</span>
    </div>
  `,
})
export class FontScaleSliderComponent {
  private fontScaleService = inject(FontScaleService);
  readonly scale = this.fontScaleService.scaleFactor;

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value)) {
      this.fontScaleService.setScale(value);
    }
  }
}
