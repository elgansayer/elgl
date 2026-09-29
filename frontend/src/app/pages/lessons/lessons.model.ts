export interface LessonSegment {
  title?: string;
  text: string;
  stream_url?: string;
}

export interface LessonContent {
  featured?: boolean;
  duration_minutes?: number;
  segments?: LessonSegment[];
  stream_url?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description?: string | null;
  content_json?: Record<string, unknown> | null;
  language_code: string;
  difficulty_level?: number | null;
  cover_image_url?: string | null;
  audio_url?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function lessonContent(lesson: Lesson): LessonContent {
  const content = asRecord(lesson.content_json);
  if (!content) return {};

  return {
    featured: content['featured'] === true,
    duration_minutes:
      typeof content['duration_minutes'] === 'number' && Number.isFinite(content['duration_minutes'])
        ? Math.max(0, Math.round(content['duration_minutes']))
        : undefined,
    stream_url: typeof content['stream_url'] === 'string' ? content['stream_url'] : undefined,
    segments: normaliseLessonSegments(lesson),
  };
}

export function normaliseLessonSegments(lesson: Lesson): LessonSegment[] {
  const content = asRecord(lesson.content_json);
  const rawSegments = content?.['segments'];
  if (Array.isArray(rawSegments)) {
    const segments = rawSegments.flatMap((value): LessonSegment[] => {
      const segment = asRecord(value);
      if (!segment) return [];
      const text = typeof segment['text'] === 'string' ? segment['text'].trim() : '';
      if (!text) return [];
      return [
        {
          text,
          title: typeof segment['title'] === 'string' ? segment['title'].trim() || undefined : undefined,
          stream_url:
            typeof segment['stream_url'] === 'string' ? segment['stream_url'].trim() || undefined : undefined,
        },
      ];
    });
    if (segments.length > 0) return segments;
  }

  const fallback = lesson.description?.trim();
  return fallback ? [{ text: fallback }] : [];
}

export function lessonDurationMinutes(lesson: Lesson): number | null {
  return lessonContent(lesson).duration_minutes ?? null;
}

export function lessonCefr(lesson: Lesson): string | null {
  const level = lesson.difficulty_level;
  if (level === null || level === undefined) return null;
  return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][level - 1] ?? null;
}

export function safeLessonMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
