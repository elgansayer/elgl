import { describe, expect, it } from 'vitest';
import { safePronunciationUrl, serializeAnkiTsv } from './anki-export.service';

const card = {
  id: '1d3a5e6f-7b8c-49d0-a123-456789abcdef',
  word_token: 'こんにちは',
  translation: 'hello',
  definition: 'a greeting',
  original_context: 'A\tline\nwith <markup>',
  pronunciation_url: 'https://cdn.example.com/audio/konnichiwa.mp3',
};

describe('Anki export serialization', () => {
  it('emits Anki import headers and stable column ordering', () => {
    const output = serializeAnkiTsv([card]);

    expect(output).toContain('#separator:tab\n');
    expect(output).toContain('#html:true\n');
    expect(output).toContain(
      '#columns:Front\tBack\tContext\tPronunciation URL\tELGL ID\n',
    );
    expect(output).toContain(
      'こんにちは\thello<br><small>a greeting</small>\tA line<br>with &lt;markup&gt;\thttps://cdn.example.com/audio/konnichiwa.mp3\t1d3a5e6f-7b8c-49d0-a123-456789abcdef',
    );
  });

  it('escapes user-authored HTML instead of creating executable imported markup', () => {
    const output = serializeAnkiTsv([
      {
        ...card,
        word_token: '<script>alert(1)</script>',
        translation: '<img src=x onerror=alert(1)>',
      },
    ]);

    expect(output).not.toContain('<script>');
    expect(output).not.toContain('<img');
    expect(output).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('keeps only absolute credential-free HTTP(S) pronunciation URLs', () => {
    expect(safePronunciationUrl('https://cdn.example.com/a.mp3')).toBe(
      'https://cdn.example.com/a.mp3',
    );
    expect(safePronunciationUrl('javascript:alert(1)')).toBe('');
    expect(safePronunciationUrl('data:audio/mp3;base64,AAAA')).toBe('');
    expect(safePronunciationUrl('https://user:secret@example.com/a.mp3')).toBe(
      '',
    );
    expect(safePronunciationUrl('not a url')).toBe('');
  });
});
