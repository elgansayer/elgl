import { MAX_VISITOR_LOGS, normalizeVisitorLogs, safeVisitorAvatarUrl } from './visitor-logs.model';

describe('visitor logs privacy boundary', () => {
  it('discards identity fields for server-masked visitors', () => {
    const [visit] = normalizeVisitorLogs([
      {
        id: 'visit-1',
        created_at: '2026-08-24T09:00:00.000Z',
        is_blurred: true,
        visitor: {
          id: 'private-user-id',
          display_name: 'Private Name',
          avatar_url: 'https://example.com/private.jpg',
          native_language: 'ja',
          target_languages: ['en'],
          bio_text: 'private profile text',
        },
      },
    ]);

    expect(visit).toEqual({
      id: 'visit-1',
      created_at: '2026-08-24T09:00:00.000Z',
      is_blurred: true,
      visitor: {
        id: 'hidden-vip-only',
        avatar_url: null,
        native_languages: [],
        target_languages: [],
      },
    });
    expect(JSON.stringify(visit)).not.toContain('Private Name');
    expect(JSON.stringify(visit)).not.toContain('private.jpg');
    expect(JSON.stringify(visit)).not.toContain('private-user-id');
  });

  it('normalizes the backend singular native_language field for visible visitors', () => {
    const [visit] = normalizeVisitorLogs([
      {
        id: 'visit-2',
        created_at: '2026-08-24T09:00:00.000Z',
        is_blurred: false,
        visitor: {
          id: 'visitor-2',
          display_name: 'Aiko',
          native_language: 'ja',
          target_languages: ['en', 'fr'],
        },
      },
    ]);

    expect(visit?.visitor.native_languages).toEqual(['ja']);
    expect(visit?.visitor.target_languages).toEqual(['en', 'fr']);
  });

  it('keeps the existing plural native_languages shape compatible', () => {
    const [visit] = normalizeVisitorLogs([
      {
        id: 'visit-3',
        created_at: '2026-08-24T09:00:00.000Z',
        is_blurred: false,
        visitor: {
          id: 'visitor-3',
          native_languages: ['de', ' de ', 42],
          target_languages: ['en'],
        },
      },
    ]);

    expect(visit?.visitor.native_languages).toEqual(['de', 'de']);
  });

  it('rejects unsafe or credential-bearing avatar URLs', () => {
    expect(safeVisitorAvatarUrl('javascript:alert(1)')).toBeNull();
    expect(safeVisitorAvatarUrl('data:image/svg+xml,<svg/>')).toBeNull();
    expect(safeVisitorAvatarUrl('https://user:secret@example.com/avatar.jpg')).toBeNull();
    expect(safeVisitorAvatarUrl('https://example.com/avatar.jpg')).toBe(
      'https://example.com/avatar.jpg',
    );
  });

  it('drops malformed rows and bounds collection size', () => {
    const validRows = Array.from({ length: MAX_VISITOR_LOGS + 5 }, (_, index) => ({
      id: `visit-${index}`,
      created_at: '2026-08-24T09:00:00.000Z',
      is_blurred: false,
      visitor: {
        id: `visitor-${index}`,
        native_language: 'en',
        target_languages: ['ja'],
      },
    }));

    expect(normalizeVisitorLogs(null)).toEqual([]);
    expect(
      normalizeVisitorLogs([
        { id: 'bad-date', created_at: 'not-a-date', is_blurred: false, visitor: { id: 'v' } },
      ]),
    ).toEqual([]);
    expect(normalizeVisitorLogs(validRows)).toHaveLength(MAX_VISITOR_LOGS);
  });
});
