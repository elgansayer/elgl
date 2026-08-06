import { ArgumentMetadata } from '@nestjs/common';
import { SanitiseHtmlPipe } from './sanitise-html.pipe';

describe('SanitiseHtmlPipe', () => {
  let pipe: SanitiseHtmlPipe;
  const mockMetadata: ArgumentMetadata = { type: 'body' };

  beforeEach(() => {
    pipe = new SanitiseHtmlPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should sanitize simple string', () => {
    expect(pipe.transform('<script>alert("xss")</script>', mockMetadata)).toBe(
      '',
    );
  });

  it('should sanitize array of strings', () => {
    expect(
      pipe.transform(['<script>alert("xss")</script>', 'safe'], mockMetadata),
    ).toEqual(['', 'safe']);
  });

  it('should sanitize nested objects', () => {
    expect(
      pipe.transform(
        {
          a: '<script>alert("xss")</script>',
          b: { c: '<a href="javascript:alert(1)">link</a>' },
        },
        mockMetadata,
      ),
    ).toEqual({
      a: '',
      b: { c: '<a>link</a>' },
    });
  });

  it('should ignore numbers, null, and undefined', () => {
    expect(pipe.transform(123, mockMetadata)).toBe(123);
    expect(pipe.transform(null, mockMetadata)).toBe(null);
    expect(pipe.transform(undefined, mockMetadata)).toBe(undefined);
  });

  it('should not mutate class instances', () => {
    class CustomClass {
      a = '<script>alert(1)</script>';
    }
    const instance = new CustomClass();
    const result = pipe.transform(instance, mockMetadata);
    expect(result).toBe(instance);
    expect((result as CustomClass).a).toBe('<script>alert(1)</script>');
  });

  it('should not mutate Buffer objects', () => {
    const buffer = Buffer.from('hello');
    const result = pipe.transform(buffer, mockMetadata);
    expect(result).toBe(buffer);
  });

  it('should skip sanitisation for passwords', () => {
    const input = {
      username: '<script>alert("xss")</script>user',
      password: 'my<secret>password',
      confirmPassword: 'my<secret>password',
    };
    const result = pipe.transform(input, mockMetadata);
    expect(result).toEqual({
      username: 'user',
      password: 'my<secret>password',
      confirmPassword: 'my<secret>password',
    });
  });
});
