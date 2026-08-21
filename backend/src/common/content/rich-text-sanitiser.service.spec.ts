import { RichTextSanitiserService } from './rich-text-sanitiser.service';

describe('RichTextSanitiserService', () => {
  let service: RichTextSanitiserService;

  beforeEach(() => {
    service = new RichTextSanitiserService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('preserves only the approved rich-text formatting surface', () => {
    const result = service.sanitise(
      '<p>Hello <strong>learner</strong><em>!</em></p><ul><li>One</li></ul>',
    );

    expect(result).toBe(
      '<p>Hello <strong>learner</strong><em>!</em></p><ul><li>One</li></ul>',
    );
  });

  it('removes script, event, style, form and SVG execution surfaces', () => {
    const result = service.sanitise(
      '<p onclick="alert(1)" style="color:red">Safe</p>' +
        '<script>alert(1)</script>' +
        '<form><input value="secret"></form>' +
        '<svg><script>alert(2)</script></svg>',
    );

    expect(result).toBe('<p>Safe</p>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('style=');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<svg');
  });

  it('retains approved links and applies safe relationship attributes', () => {
    const result = service.sanitise(
      '<a href="https://example.com/path" title="Example">Example</a>',
    );

    expect(result).toContain('href="https://example.com/path"');
    expect(result).toContain('title="Example"');
    expect(result).toContain('rel="noopener noreferrer nofollow"');
  });

  it('removes executable and unknown link protocols', () => {
    const result = service.sanitise(
      '<a href="javascript:alert(1)">One</a>' +
        '<a href="data:text/html,hello">Two</a>' +
        '<a href="custom:thing">Three</a>',
    );

    expect(result).toBe(
      '<a rel="noopener noreferrer nofollow">One</a>' +
        '<a rel="noopener noreferrer nofollow">Two</a>' +
        '<a rel="noopener noreferrer nofollow">Three</a>',
    );
  });

  it('allows internal routes, fragments and mail links', () => {
    const result = service.sanitise(
      '<a href="/help">Help</a>' +
        '<a href="#section">Section</a>' +
        '<a href="mailto:support@example.com">Email</a>',
    );

    expect(result).toContain('href="/help"');
    expect(result).toContain('href="#section"');
    expect(result).toContain('href="mailto:support@example.com"');
  });

  it('treats literal unknown markup as outside the rich-text policy', () => {
    expect(service.sanitise('Use <example> in this sentence')).toBe(
      'Use  in this sentence',
    );
  });
});
