import { SanitiseHtmlPipe } from './sanitise-html.pipe';

describe('SanitiseHtmlPipe', () => {
  let pipe: SanitiseHtmlPipe;

  beforeEach(() => {
    pipe = new SanitiseHtmlPipe();
  });

  it('should sanitize simple string', () => {
    expect(pipe.transform('<script>alert("xss")</script>', {} as any)).toBe(
      '',
    );
  });

  it('should sanitize array of strings', () => {
    expect(
      pipe.transform(['<script>alert("xss")</script>', 'safe'], {} as any),
    ).toEqual(['', 'safe']);
  });

  it('should sanitize nested objects', () => {
    expect(
      pipe.transform(
        {
          a: '<script>alert("xss")</script>',
          b: { c: '<a href="javascript:alert(1)">link</a>' },
        },
        {} as any,
      ),
    ).toEqual({
      a: '',
      b: { c: '<a>link</a>' },
    });
  });

  it('should ignore numbers, null, and undefined', () => {
    expect(pipe.transform(123, {} as any)).toBe(123);
    expect(pipe.transform(null, {} as any)).toBe(null);
    expect(pipe.transform(undefined, {} as any)).toBe(undefined);
  });

  it('should not mutate class instances', () => {
    class CustomClass {
      a = '<script>alert(1)</script>';
    }
    const instance = new CustomClass();
    const result = pipe.transform(instance, {} as any);
    expect(result).toBe(instance);
    expect(result.a).toBe('<script>alert(1)</script>');
  });

  it('should not mutate Buffer objects', () => {
    const buffer = Buffer.from('hello');
    const result = pipe.transform(buffer, {} as any);
    expect(result).toBe(buffer);
  });
});
