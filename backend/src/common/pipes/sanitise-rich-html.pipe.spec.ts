import { BadRequestException } from '@nestjs/common';
import { RichTextSanitiserService } from '../content/rich-text-sanitiser.service';
import { SanitiseRichHtmlPipe } from './sanitise-rich-html.pipe';

describe('SanitiseRichHtmlPipe', () => {
  let sanitiser: RichTextSanitiserService;
  let pipe: SanitiseRichHtmlPipe;

  beforeEach(() => {
    sanitiser = new RichTextSanitiserService();
    pipe = new SanitiseRichHtmlPipe(sanitiser);
  });

  afterEach(() => {
    sanitiser.onModuleDestroy();
  });

  it('sanitises a field explicitly declared as rich HTML', () => {
    expect(
      pipe.transform('<p>Hello <strong>world</strong></p><script>x</script>'),
    ).toBe('<p>Hello <strong>world</strong></p>');
  });

  it('rejects non-string input rather than recursively mutating a DTO', () => {
    expect(() => pipe.transform({ body: '<p>hello</p>' })).toThrow(
      BadRequestException,
    );
  });
});
