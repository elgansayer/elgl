import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { RichTextSanitiserService } from '../content/rich-text-sanitiser.service';

/**
 * Opt-in pipe for DTO/controller fields whose documented storage contract is
 * `rich-text-html-v1`.
 *
 * Do not register this pipe globally and do not apply it to ordinary plain
 * text, credentials, signatures, JSON or identifiers.
 */
@Injectable()
export class SanitiseRichHtmlPipe implements PipeTransform<unknown, string> {
  constructor(private readonly richTextSanitiser: RichTextSanitiserService) {}

  transform(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('Rich text must be a string');
    }
    return this.richTextSanitiser.sanitise(value);
  }
}
