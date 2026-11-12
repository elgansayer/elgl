import { parseSessionSummary } from './summary-output';

describe('parseSessionSummary', () => {
  it('returns a clean summary and vocabulary', () => {
    expect(
      parseSessionSummary(
        JSON.stringify({
          summary: '  Travel and food.  ',
          vocabulary: ['ticket', 'menu'],
        }),
      ),
    ).toEqual({ summary: 'Travel and food.', vocabulary: ['ticket', 'menu'] });
  });

  it('finds the JSON object inside surrounding prose or a code fence', () => {
    expect(
      parseSessionSummary(
        'Here you go:\n```json\n{"summary":"Topic.","vocabulary":["word"]}\n```',
      ),
    ).toEqual({ summary: 'Topic.', vocabulary: ['word'] });
  });

  it.each([
    ['no JSON at all', 'plain text only'],
    ['invalid JSON', '{"summary": '],
    ['a JSON array', '[1, 2]'],
    ['an empty object', '{}'],
    ['wrong types', '{"summary": 5, "vocabulary": "word"}'],
    ['an empty summary and vocabulary', '{"summary":"  ","vocabulary":[]}'],
  ])('returns null for %s', (_label, raw) => {
    expect(parseSessionSummary(raw)).toBeNull();
  });

  it('removes links and active content from the summary', () => {
    const result = parseSessionSummary(
      JSON.stringify({
        summary:
          'Talked about food. Visit https://evil.example/login or [here](https://evil.example) <script>x</script>.',
        vocabulary: [],
      }),
    );

    expect(result?.summary).toBe('Talked about food. Visit or here x.');
  });

  it('caps the summary length', () => {
    const result = parseSessionSummary(
      JSON.stringify({ summary: 'x'.repeat(5_000), vocabulary: [] }),
    );
    expect(result?.summary).toHaveLength(2_000);
  });

  it('drops vocabulary entries that are not short plain single-line terms', () => {
    const result = parseSessionSummary(
      JSON.stringify({
        summary: '',
        vocabulary: [
          'good',
          42,
          null,
          '',
          '   ',
          'two\nlines',
          'x'.repeat(101),
          'see https://evil.example/a',
          '<img src=x>',
          'hid\u{200B}den',
          'good',
          'also good',
        ],
      }),
    );

    expect(result).toEqual({ summary: '', vocabulary: ['good', 'also good'] });
  });

  it('keeps at most ten vocabulary entries', () => {
    const result = parseSessionSummary(
      JSON.stringify({
        summary: 'ok',
        vocabulary: Array.from({ length: 25 }, (_, index) => `word${index}`),
      }),
    );
    expect(result?.vocabulary).toHaveLength(10);
    expect(result?.vocabulary[9]).toBe('word9');
  });
});
