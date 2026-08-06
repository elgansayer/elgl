import { SanitiseHtmlPipe } from './sanitise-html.pipe';

describe('SanitiseHtmlPipe', () => {
  let pipe: SanitiseHtmlPipe;

  beforeEach(() => {
    pipe = new SanitiseHtmlPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should sanitise XSS in a string', () => {
    const input = '<script>alert("xss")</script><p>Hello</p>';
    const result = pipe.transform(input, {} as any);
    expect(result).toBe('<p>Hello</p>');
  });

  it('should leave innocent text alone', () => {
    const input = 'Hello World';
    const result = pipe.transform(input, {} as any);
    expect(result).toBe('Hello World');
  });

  it('should properly traverse objects and sanitise their properties', () => {
    const input = {
      message: 'Hello <script>alert("xss")</script>',
      user: {
        bio: '<img src="x" onerror="alert(1)">I like coding',
        nested: {
          test: '<iframe src="javascript:alert(1)"></iframe>safe',
        },
      },
    };
    const result = pipe.transform(input, {} as any);
    expect(result).toEqual({
      message: 'Hello ',
      user: {
        bio: '<img src="x">I like coding',
        nested: {
          test: 'safe',
        },
      },
    });
  });

  it('should properly traverse arrays and sanitise items', () => {
    const input = ['<script>alert("xss")</script>item1', 'item2'];
    const result = pipe.transform(input, {} as any);
    expect(result).toEqual(['item1', 'item2']);
  });

  it('should leave non-plain objects untouched', () => {
    class DTO {
      prop = '<script>alert("xss")</script>';
    }
    const input = new DTO();
    const result = pipe.transform(input, {} as any);
    expect(result).toBe(input); // Object reference should be the same
    expect(result.prop).toBe('<script>alert("xss")</script>');
  });

  it('should leave Buffers untouched', () => {
    const input = Buffer.from('<script>alert("xss")</script>');
    const result = pipe.transform(input, {} as any);
    expect(result).toBe(input);
  });

  it('should leave null and undefined untouched', () => {
    expect(pipe.transform(null, {} as any)).toBe(null);
    expect(pipe.transform(undefined, {} as any)).toBe(undefined);
  });

  it('should skip sanitisation for passwords', () => {
    const input = {
      username: '<script>alert("xss")</script>user',
      password: 'my<secret>password',
      confirmPassword: 'my<secret>password',
    };
    const result = pipe.transform(input, {} as any);
    expect(result).toEqual({
      username: 'user',
      password: 'my<secret>password',
      confirmPassword: 'my<secret>password',
    });
  });
});
