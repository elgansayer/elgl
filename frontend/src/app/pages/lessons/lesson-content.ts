import type { LessonSection } from './lessons.model';

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function lessonSections(
  content: Record<string, unknown> | null | undefined,
): LessonSection[] {
  if (!content) return [];

  const rawSections = content['sections'];
  if (Array.isArray(rawSections)) {
    return rawSections
      .map((section): LessonSection | null => {
        if (typeof section === 'string') {
          const body = asText(section);
          return body ? { title: null, body } : null;
        }
        if (!section || typeof section !== 'object' || Array.isArray(section)) {
          return null;
        }

        const record = section as Record<string, unknown>;
        const body =
          asText(record['body']) ??
          asText(record['text']) ??
          asText(record['content']);
        if (!body) return null;

        return {
          title: asText(record['title']),
          body,
        };
      })
      .filter((section): section is LessonSection => section !== null);
  }

  const directBody =
    asText(content['body']) ?? asText(content['text']) ?? asText(content['content']);
  if (directBody) return [{ title: null, body: directBody }];

  return Object.entries(content)
    .map(([title, value]): LessonSection | null => {
      const body = asText(value);
      return body ? { title, body } : null;
    })
    .filter((section): section is LessonSection => section !== null);
}
