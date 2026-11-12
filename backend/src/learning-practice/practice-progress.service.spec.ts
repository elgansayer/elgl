import { Logger } from '@nestjs/common';
import type { Mock } from 'vitest';
import type { SupabaseService } from '../supabase/supabase.service';
import { PracticeProgressService } from './practice-progress.service';

function createSupabase(overrides: {
  insertError?: { code: string } | null;
  selectResult?: { data: unknown; error: { code?: string } | null };
  throwOnInsert?: boolean;
  throwOnSelect?: boolean;
}): {
  supabase: SupabaseService;
  insert: Mock;
  select: Mock;
  eq: Mock;
  order: Mock;
  limit: Mock;
} {
  const limit = vi
    .fn()
    .mockResolvedValue(overrides.selectResult ?? { data: [], error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn();
  eq.mockReturnValue({ eq, order });
  const select = vi.fn().mockReturnValue({ eq });
  const insert = overrides.throwOnInsert
    ? vi.fn().mockRejectedValue(new Error('network'))
    : vi.fn().mockResolvedValue({ error: overrides.insertError ?? null });
  const from = vi.fn().mockReturnValue({ insert, select });

  return {
    supabase: {
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService,
    insert,
    select,
    eq,
    order,
    limit,
  };
}

describe('PracticeProgressService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores a sanitised practice attempt', async () => {
    const { supabase, insert } = createSupabase({});
    const service = new PracticeProgressService(supabase);

    await service.recordAttempt({
      userId: 'user-1',
      module: 'verb_conjugation',
      itemId: 'verb:es:hablar:present:0',
      languageCode: 'es',
      submittedAnswer: 'hablo',
      correct: true,
    });

    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      module: 'verb_conjugation',
      item_id: 'verb:es:hablar:present:0',
      language_code: 'es',
      submitted_answer: 'hablo',
      correct: true,
    });
  });

  it('never fails a graded attempt when persistence is unavailable', async () => {
    const { supabase } = createSupabase({ throwOnInsert: true });
    const service = new PracticeProgressService(supabase);

    await expect(
      service.recordAttempt({
        userId: 'user-1',
        module: 'ipa_alphabet',
        itemId: 'ipa:en:i-long',
        languageCode: 'en',
        submittedAnswer: 'see',
        correct: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('aggregates recent attempts into totals and language breakdowns', async () => {
    const { supabase, select, eq, order, limit } = createSupabase({
      selectResult: {
        data: [
          { correct: true, language_code: 'es' },
          { correct: false, language_code: 'es' },
          { correct: true, language_code: 'fr' },
        ],
        error: null,
      },
    });
    const service = new PracticeProgressService(supabase);

    await expect(
      service.summarise('user-1', 'verb_conjugation'),
    ).resolves.toEqual({
      total: 3,
      correct: 2,
      accuracy: 67,
      byLanguage: [
        { languageCode: 'es', total: 2, correct: 1 },
        { languageCode: 'fr', total: 1, correct: 1 },
      ],
    });
    expect(select).toHaveBeenCalledWith('correct, language_code');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eq).toHaveBeenCalledWith('module', 'verb_conjugation');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(500);
  });

  it('returns an empty summary when the lookup fails', async () => {
    const { supabase } = createSupabase({
      selectResult: { data: null, error: { code: 'PGRST500' } },
    });
    const service = new PracticeProgressService(supabase);

    await expect(service.summarise('user-1', 'ipa_alphabet')).resolves.toEqual({
      total: 0,
      correct: 0,
      accuracy: 0,
      byLanguage: [],
    });
  });

  it('returns an empty summary when the database client throws', async () => {
    const { supabase } = createSupabase({ throwOnSelect: true });
    (supabase.getClient as Mock).mockImplementation(() => {
      throw new Error('offline');
    });
    const service = new PracticeProgressService(supabase);

    await expect(service.summarise('user-1', 'ipa_alphabet')).resolves.toEqual({
      total: 0,
      correct: 0,
      accuracy: 0,
      byLanguage: [],
    });
  });
});
