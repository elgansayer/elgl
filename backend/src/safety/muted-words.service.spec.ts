import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { MAX_MUTED_WORDS, MutedWordsService } from './muted-words.service';

function listBuilder(
  data: Array<{ normalized_word: string }> = [],
  error: unknown = null,
) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe('MutedWordsService', () => {
  it('normalises Unicode, whitespace and case when listing preferences', async () => {
    const builder = listBuilder([
      { normalized_word: '  CAFÉ  ' },
      { normalized_word: 'ＳＰＯＩＬＥＲ' },
    ]);
    const client = { from: vi.fn().mockReturnValue(builder) };
    const service = new MutedWordsService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(service.list('user-1')).resolves.toEqual(['café', 'spoiler']);
    expect(client.from).toHaveBeenCalledWith('user_muted_words');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('fails closed when persisted preferences cannot be read', async () => {
    const client = {
      from: vi.fn().mockReturnValue(listBuilder([], { message: 'offline' })),
    };
    const service = new MutedWordsService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(service.list('user-1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('treats duplicate additions as idempotent without another write', async () => {
    const builder = listBuilder([{ normalized_word: 'spoiler' }]);
    const client = { from: vi.fn().mockReturnValue(builder) };
    const service = new MutedWordsService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(service.add('user-1', '  SPOILER ')).resolves.toEqual([
      'spoiler',
    ]);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it('rejects empty, overlong and over-capacity preferences', async () => {
    const client = { from: vi.fn() };
    const service = new MutedWordsService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(service.add('user-1', '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.add('user-1', 'x'.repeat(65))).rejects.toBeInstanceOf(
      BadRequestException,
    );

    client.from.mockReturnValue(
      listBuilder(
        Array.from({ length: MAX_MUTED_WORDS }, (_, index) => ({
          normalized_word: `word-${index}`,
        })),
      ),
    );
    await expect(service.add('user-1', 'one-more')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('persists an owner-scoped normalised word and returns canonical state', async () => {
    const before = listBuilder([]);
    const insert = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    const after = listBuilder([{ normalized_word: 'spoiler' }]);
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(before)
        .mockReturnValueOnce(insert)
        .mockReturnValueOnce(after),
    };
    const service = new MutedWordsService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(service.add('user-1', 'ＳＰＯＩＬＥＲ')).resolves.toEqual([
      'spoiler',
    ]);
    expect(insert.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      word: 'spoiler',
      normalized_word: 'spoiler',
    });
  });

  it('deletes only the authenticated owner word', async () => {
    const deleteBuilder = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn(),
    };
    deleteBuilder.eq
      .mockReturnValueOnce(deleteBuilder)
      .mockResolvedValueOnce({ error: null });
    const after = listBuilder([{ normalized_word: 'other' }]);
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(deleteBuilder)
        .mockReturnValueOnce(after),
    };
    const service = new MutedWordsService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(service.remove('user-1', ' Spoiler ')).resolves.toEqual([
      'other',
    ]);
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(deleteBuilder.eq).toHaveBeenNthCalledWith(
      2,
      'normalized_word',
      'spoiler',
    );
  });

  it('does not expose provider details when writes fail', async () => {
    const before = listBuilder([]);
    const insert = {
      insert: vi.fn().mockResolvedValue({
        error: { code: 'XX000', message: 'secret provider detail' },
      }),
    };
    const client = {
      from: vi.fn().mockReturnValueOnce(before).mockReturnValueOnce(insert),
    };
    const service = new MutedWordsService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(service.add('user-1', 'spoiler')).rejects.toMatchObject({
      message: 'Failed to save muted word',
    });
  });
});
