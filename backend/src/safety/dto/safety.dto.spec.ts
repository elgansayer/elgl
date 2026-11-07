import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BlockUserDto,
  ReportUserDto,
  UnblockUserDto,
  trimToUndefined,
} from './safety.dto';
import {
  SAFETY_REPORT_CATEGORY_VALUES,
  SAFETY_REPORT_CONTEXT_URL_MAX_LENGTH,
  SAFETY_REPORT_DESCRIPTION_MAX_LENGTH,
} from '../safety.constants';

const TARGET = '22222222-2222-4222-8222-222222222222';

const toReport = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(ReportUserDto, {
    reported_id: TARGET,
    reason_category: 'harassment',
    ...overrides,
  });

const invalidProperties = async (dto: object) =>
  (await validate(dto)).map((error) => error.property);

describe('ReportUserDto', () => {
  it('accepts a minimal valid report', async () => {
    expect(await validate(toReport())).toHaveLength(0);
  });

  it.each(SAFETY_REPORT_CATEGORY_VALUES)(
    'accepts the %s category',
    async (category) => {
      expect(
        await validate(toReport({ reason_category: category })),
      ).toHaveLength(0);
    },
  );

  it.each(['inappropriate', 'scam', 'admin_warning', '', 'HARASSMENT'])(
    'rejects the unknown category %p',
    async (category) => {
      expect(
        await invalidProperties(toReport({ reason_category: category })),
      ).toEqual(['reason_category']);
    },
  );

  it.each(['user-1', '', 'not-a-uuid', '2222', 12345, null])(
    'rejects the target identifier %p',
    async (reportedId) => {
      expect(
        await invalidProperties(toReport({ reported_id: reportedId })),
      ).toEqual(['reported_id']);
    },
  );

  it('trims the description and treats a blank one as absent', async () => {
    expect(toReport({ description: '  spammy links  ' }).description).toBe(
      'spammy links',
    );
    const blank = toReport({ description: '   ' });
    expect(blank.description).toBeUndefined();
    expect(await validate(blank)).toHaveLength(0);
  });

  it('accepts a description at the limit and rejects one above it', async () => {
    const atLimit = 'a'.repeat(SAFETY_REPORT_DESCRIPTION_MAX_LENGTH);
    expect(await validate(toReport({ description: atLimit }))).toHaveLength(0);
    expect(
      await invalidProperties(toReport({ description: `${atLimit}a` })),
    ).toEqual(['description']);
  });

  it('measures the description limit after trimming', async () => {
    const padded = ` ${'a'.repeat(SAFETY_REPORT_DESCRIPTION_MAX_LENGTH)} `;
    expect(await validate(toReport({ description: padded }))).toHaveLength(0);
  });

  it('rejects a non-string description', async () => {
    expect(await invalidProperties(toReport({ description: 42 }))).toEqual([
      'description',
    ]);
  });

  it.each([
    '/profile/22222222-2222-4222-8222-222222222222',
    '/chat/room-1?tab=members#top',
    'https://app.example.com/moments/abc',
    'http://localhost:4200/discover',
  ])('accepts the context link %s', async (contextUrl) => {
    expect(await validate(toReport({ context_url: contextUrl }))).toHaveLength(
      0,
    );
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'ftp://example.com/file',
    '//evil.example.com/path',
    'relative/path',
    '/path with space',
    '/path"onmouseover="x',
    "/path'><script>",
    '/back\\slash',
    'https://exa mple.com',
  ])('rejects the unsafe context link %p', async (contextUrl) => {
    expect(
      await invalidProperties(toReport({ context_url: contextUrl })),
    ).toEqual(['context_url']);
  });

  it('rejects an over-long context link', async () => {
    const tooLong = `/${'a'.repeat(SAFETY_REPORT_CONTEXT_URL_MAX_LENGTH)}`;
    expect(
      await invalidProperties(toReport({ context_url: tooLong })),
    ).toContain('context_url');
  });

  it('treats a blank context link as absent', async () => {
    const dto = toReport({ context_url: '  ' });
    expect(dto.context_url).toBeUndefined();
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe.each([
  ['BlockUserDto', BlockUserDto],
  ['UnblockUserDto', UnblockUserDto],
])('%s', (_name, dtoClass) => {
  it('accepts a UUID', async () => {
    const dto = plainToInstance(dtoClass, { blocked_id: TARGET });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['', 'user-1', 7, undefined])('rejects %p', async (value) => {
    const dto = plainToInstance(dtoClass, { blocked_id: value });
    expect(await invalidProperties(dto)).toEqual(['blocked_id']);
  });
});

describe('trimToUndefined', () => {
  it('passes non-strings through untouched so validators can reject them', () => {
    expect(trimToUndefined({ value: 5 })).toBe(5);
    expect(trimToUndefined({ value: null })).toBeNull();
  });
});
