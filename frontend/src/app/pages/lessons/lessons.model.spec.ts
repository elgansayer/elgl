import { describe, expect, it } from 'vitest';
import {
  lessonCefr,
  lessonContent,
  normaliseLessonSegments,
  safeLessonMediaUrl,
  type Lesson,
} from './lessons.model';

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'lesson-1',
    title: 'Greetings',
    language_code: 'ja',
    ...overrides,
  };
}

describe('lesson model helpers', () => {
  it('normalises curated segments and ignores malformed entries', () => {
    const value = lesson({
      description: 'Fallback',
      content_json: {
        segments: [
          { title: 'Part 1', text: '  Hello  ', stream_url: ' https://example.com/live ' },
          { text: '   ' },
          null,
        ],
      },
    });

    expect(normaliseLessonSegments(value)).toEqual([
      { title: 'Part 1', text: 'Hello', stream_url: 'https://example.com/live' },
    ]);
  });

  it('falls back to the plain-text description when no segments are usable', () => {
    expect(normaliseLessonSegments(lesson({ description: '  Practice greetings.  ' }))).toEqual([
      { text: 'Practice greetings.' },
    ]);
  });

  it('reads bounded presentation metadata without trusting arbitrary JSON types', () => {
    expect(
      lessonContent(
        lesson({
          content_json: { featured: true, duration_minutes: 12.4, stream_url: 42 },
        }),
      ),
    ).toEqual({
      featured: true,
      duration_minutes: 12,
      stream_url: undefined,
      segments: [],
    });
  });

  it('maps numeric lesson difficulty to CEFR labels', () => {
    expect(lessonCefr(lesson({ difficulty_level: 1 }))).toBe('A1');
    expect(lessonCefr(lesson({ difficulty_level: 6 }))).toBe('C2');
    expect(lessonCefr(lesson({ difficulty_level: 7 }))).toBeNull();
  });

  it('accepts only http(s) media URLs', () => {
    expect(safeLessonMediaUrl('https://cdn.example.com/audio.mp3')).toBe(
      'https://cdn.example.com/audio.mp3',
    );
    expect(safeLessonMediaUrl('javascript:alert(1)')).toBeNull();
    expect(safeLessonMediaUrl('not a url')).toBeNull();
  });
});
