import { Global, Module } from '@nestjs/common';
import { SanitiseHtmlPipe } from '../pipes/sanitise-html.pipe';
import { SanitiseRichHtmlPipe } from '../pipes/sanitise-rich-html.pipe';
import { RichTextSanitiserService } from './rich-text-sanitiser.service';

@Global()
@Module({
  providers: [RichTextSanitiserService, SanitiseRichHtmlPipe, SanitiseHtmlPipe],
  exports: [RichTextSanitiserService, SanitiseRichHtmlPipe, SanitiseHtmlPipe],
})
export class ContentSecurityModule {}
