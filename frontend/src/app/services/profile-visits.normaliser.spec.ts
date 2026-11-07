import {
  HIDDEN_VISITOR_ID,
  MAX_PROFILE_VISITS_PER_PAGE,
  normaliseProfileVisitorsPage,
  safeVisitorAvatarUrl,
} from './profile-visits.normaliser';

const REQUEST = { limit: 20, offset: 0 };

function visibleRow(index: number, visitor: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `visit-${index}`,
    created_at: '2026-08-24T09:00:00.000Z',
    is_blurred: false,
    visitor: {
      id: `visitor-${index}`,
      display_name: `Visitor ${index}`,
      avatar_url: `https://example.com/${index}.jpg`,
      native_languages: ['en'],
      target_languages: ['ja'],
      ...visitor,
    },
  };
}

function page(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    items: [],
    identity_visible: true,
    limit: 20,
    offset: 0,
    has_more: false,
    next_offset: null,
    ...overrides,
  };
}

describe('profile visitor page privacy boundary', () => {
  it('replaces every row with an opaque placeholder when the server withholds identities', () => {
    const result = normaliseProfileVisitorsPage(
      page({
        identity_visible: false,
        items: [
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
        ],
      }),
      REQUEST,
    );

    expect(result.identity_visible).toBe(false);
    expect(result.items).toEqual([
      {
        id: 'visit-1',
        created_at: '2026-08-24T09:00:00.000Z',
        is_blurred: true,
        visitor: {
          id: HIDDEN_VISITOR_ID,
          avatar_url: null,
          native_languages: [],
          target_languages: [],
        },
      },
    ]);

    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('Private Name');
    expect(serialised).not.toContain('private.jpg');
    expect(serialised).not.toContain('private-user-id');
    expect(serialised).not.toContain('private profile text');
  });

  it('fails closed when a page claims identity_visible but still returns identity for every row', () => {
    const result = normaliseProfileVisitorsPage(
      page({ identity_visible: false, items: [visibleRow(1)] }),
      REQUEST,
    );

    expect(result.identity_visible).toBe(false);
    expect(result.items[0]?.is_blurred).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Visitor 1');
    expect(JSON.stringify(result)).not.toContain('visitor-1');
  });

  it('masks the whole page when any row is flagged is_blurred, even if identity_visible is true', () => {
    const maskedRow = { ...visibleRow(2), is_blurred: true };
    const result = normaliseProfileVisitorsPage(
      page({ identity_visible: true, items: [visibleRow(1), maskedRow] }),
      REQUEST,
    );

    expect(result.identity_visible).toBe(false);
    expect(result.items.every((item) => item.is_blurred)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Visitor 1');
    expect(JSON.stringify(result)).not.toContain('Visitor 2');
  });

  it('keeps masked rows that carry no visitor object at all', () => {
    const result = normaliseProfileVisitorsPage(
      page({
        identity_visible: false,
        items: [{ id: 'visit-9', created_at: '2026-08-24T09:00:00.000Z', is_blurred: true }],
      }),
      REQUEST,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.visitor.id).toBe(HIDDEN_VISITOR_ID);
  });

  it('keeps visible identities for a fully visible page', () => {
    const result = normaliseProfileVisitorsPage(
      page({ items: [visibleRow(1), visibleRow(2)] }),
      REQUEST,
    );

    expect(result.identity_visible).toBe(true);
    expect(result.items.map((item) => item.visitor.display_name)).toEqual([
      'Visitor 1',
      'Visitor 2',
    ]);
    expect(result.items.every((item) => !item.is_blurred)).toBe(true);
  });

  it('drops a visible row whose visitor id is the opaque placeholder or missing', () => {
    const result = normaliseProfileVisitorsPage(
      page({
        items: [
          visibleRow(1, { id: HIDDEN_VISITOR_ID }),
          visibleRow(2, { id: '   ' }),
          { id: 'visit-3', created_at: '2026-08-24T09:00:00.000Z', is_blurred: false },
          visibleRow(4),
        ],
      }),
      REQUEST,
    );

    expect(result.items.map((item) => item.id)).toEqual(['visit-4']);
  });

  it('normalises the singular native_language field and the plural shape', () => {
    const result = normaliseProfileVisitorsPage(
      page({
        items: [
          visibleRow(1, { native_languages: undefined, native_language: 'ja' }),
          visibleRow(2, { native_languages: ['de', ' de ', 42] }),
        ],
      }),
      REQUEST,
    );

    expect(result.items[0]?.visitor.native_languages).toEqual(['ja']);
    expect(result.items[1]?.visitor.native_languages).toEqual(['de', 'de']);
  });

  it('rejects unsafe or credential-bearing avatar URLs', () => {
    expect(safeVisitorAvatarUrl('javascript:alert(1)')).toBeNull();
    expect(safeVisitorAvatarUrl('data:image/svg+xml,<svg/>')).toBeNull();
    expect(safeVisitorAvatarUrl('https://user:secret@example.com/avatar.jpg')).toBeNull();
    expect(safeVisitorAvatarUrl('not a url')).toBeNull();
    expect(safeVisitorAvatarUrl(42)).toBeNull();
    expect(safeVisitorAvatarUrl('https://example.com/avatar.jpg')).toBe(
      'https://example.com/avatar.jpg',
    );

    const result = normaliseProfileVisitorsPage(
      page({ items: [visibleRow(1, { avatar_url: 'javascript:alert(1)' })] }),
      REQUEST,
    );
    expect(result.items[0]?.visitor.avatar_url).toBeNull();
  });
});

describe('profile visitor page structure', () => {
  it('throws for payloads that are not a visitor page so callers can show a retry state', () => {
    expect(() => normaliseProfileVisitorsPage(null, REQUEST)).toThrow();
    expect(() => normaliseProfileVisitorsPage('oops', REQUEST)).toThrow();
    expect(() => normaliseProfileVisitorsPage([], REQUEST)).toThrow();
    expect(() => normaliseProfileVisitorsPage({ identity_visible: true }, REQUEST)).toThrow();
    expect(() => normaliseProfileVisitorsPage({ items: 'nope' }, REQUEST)).toThrow();
  });

  it('drops malformed rows and bounds the collection to one backend page', () => {
    const rows = Array.from({ length: MAX_PROFILE_VISITS_PER_PAGE + 5 }, (_, index) =>
      visibleRow(index),
    );

    const result = normaliseProfileVisitorsPage(
      page({
        items: [
          'not-a-row',
          { id: 'bad-date', created_at: 'not-a-date', is_blurred: false, visitor: { id: 'v' } },
          { created_at: '2026-08-24T09:00:00.000Z', is_blurred: false, visitor: { id: 'v' } },
          ...rows,
        ],
      }),
      REQUEST,
    );

    // The three malformed rows consume part of the 50-row window before any validation.
    expect(result.items).toHaveLength(MAX_PROFILE_VISITS_PER_PAGE - 3);
    expect(result.items.some((item) => item.id === 'bad-date')).toBe(false);
  });

  it('passes through a forward cursor and clears it when there is no further page', () => {
    const more = normaliseProfileVisitorsPage(
      page({ has_more: true, next_offset: 20, offset: 0 }),
      REQUEST,
    );
    expect(more).toMatchObject({ has_more: true, next_offset: 20, offset: 0, limit: 20 });

    const last = normaliseProfileVisitorsPage(
      page({ has_more: false, next_offset: 40, offset: 20 }),
      { limit: 20, offset: 20 },
    );
    expect(last).toMatchObject({ has_more: false, next_offset: null, offset: 20 });
  });

  it('refuses a repeated, backwards or malformed cursor so load-more cannot loop', () => {
    const repeated = normaliseProfileVisitorsPage(
      page({ has_more: true, next_offset: 20, offset: 20 }),
      { limit: 20, offset: 20 },
    );
    expect(repeated.next_offset).toBe(40);

    const backwards = normaliseProfileVisitorsPage(
      page({ has_more: true, next_offset: 0, offset: 20 }),
      { limit: 20, offset: 20 },
    );
    expect(backwards.next_offset).toBe(40);

    const malformed = normaliseProfileVisitorsPage(
      page({ has_more: true, next_offset: 'later', offset: 0 }),
      REQUEST,
    );
    expect(malformed.next_offset).toBe(20);
  });

  it('falls back to the requested window and clamps unusable limits', () => {
    const result = normaliseProfileVisitorsPage(
      { items: [], identity_visible: false },
      { limit: 500, offset: -4 },
    );

    expect(result).toMatchObject({
      limit: MAX_PROFILE_VISITS_PER_PAGE,
      offset: 0,
      has_more: false,
      next_offset: null,
    });
  });
});
