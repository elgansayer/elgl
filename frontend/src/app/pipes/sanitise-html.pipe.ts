import { Pipe, PipeTransform, inject } from '@angular/core';
import { HtmlSanitisationService } from '../services/html-sanitisation.service';

/**
 * Standalone pipe that applies strict DOMPurify HTML sanitisation to
 * user-generated content in templates. Strips ALL HTML tags and
 * dangerous URLs, returning plain text only.
 *
 * Usage: {{ userContent | sanitiseHtml }}
 */
@Pipe({
  name: 'sanitiseHtml',
  standalone: true,
})
export class SanitiseHtmlPipe implements PipeTransform {
  private readonly sanitisation = inject(HtmlSanitisationService);

  transform(value: string | null | undefined): string {
    if (!value || typeof value !== 'string') return '';
    return this.sanitisation.sanitiseText(value);
  }
}