import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

@Pipe({
  name: 't',
  pure: false,
  standalone: true,
})
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(key: string, params?: Record<string, unknown>): string {
    if (!key) return '';
    return this.i18n.translate(key, params);
  }
}
