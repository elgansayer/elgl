import { Pipe, PipeTransform, inject } from '@angular/core';
import { HtmlSanitisationService } from './html-sanitisation.service';

@Pipe({
  name: 'sanitise',
  pure: true,
  standalone: true,
})
export class SanitisePipe implements PipeTransform {
  private sanitisation = inject(HtmlSanitisationService);

  transform(value: string | null | undefined): string {
    return this.sanitisation.sanitiseText(value ?? '');
  }
}