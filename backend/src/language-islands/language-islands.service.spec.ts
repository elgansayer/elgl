import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { LanguageIslandsService } from './language-islands.service';
import { SupabaseService } from '../supabase/supabase.service';

type Chain = Record<string, ReturnType<typeof vi.fn>> & {
  then: unknown;
};

function chain(result: unknown): Chain {
  const query: Record<string, unknown> = {};
  for (const method of [
    'select',
    'insert',
    'delete',
    'eq',
    'in',
    'order',
    'range',
  ]) {
    query[method] = vi.fn(() => query);
  }
  query['single'] = vi.fn(() => Promise.resolve(result));
  query['maybeSingle'] = vi.fn(() => Promise.resolve(result));
  query['then'] = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return query as Chain;
}

const islandRow = {
  id: 'island-1',
  name: 'Spanish Corner',
  description: null,
  language_pair: 'es-en',
  host_id: 'host-1',
  max_members: 10,
  is_active: true,
  created_at: '2026-11-14T00:00:00.000Z',
};

describe('LanguageIslandsService', () => {
  let service: LanguageIslandsService;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    from = vi.fn();
    service = new LanguageIslandsService({
      getClient: () => ({ from }),
    } as unknown as SupabaseService);
  });

  it('lists active islands with member counts', async () => {
    from
      .mockReturnValueOnce(chain({ data: [islandRow], error: null }))
      .mockReturnValueOnce(
        chain({ data: [{ island_id: 'island-1' }], error: null }),
      );

    const result = await service.list({ language_pair: 'es-en' }, 'user-1');

    expect(result).toEqual([
      expect.objectContaining({ id: 'island-1', member_count: 1 }),
    ]);
  });

  it('fails loudly when the island listing query fails', async () => {
    from.mockReturnValueOnce(chain({ data: null, error: { message: 'down' } }));

    await expect(service.list({})).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('reports a missing island', async () => {
    from.mockReturnValueOnce(
      chain({ data: null, error: { message: 'missing' } }),
    );

    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a join when the island is full', async () => {
    from
      .mockReturnValueOnce(chain({ data: { max_members: 1 }, error: null }))
      .mockReturnValueOnce(chain({ count: 1, error: null }));

    await expect(service.join('island-1', 'user-2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('treats an existing membership as idempotent', async () => {
    from
      .mockReturnValueOnce(chain({ data: { max_members: null }, error: null }))
      .mockReturnValueOnce(chain({ data: { id: 'member-1' }, error: null }));

    await expect(service.join('island-1', 'user-2')).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('refuses deletion by a non-host', async () => {
    from
      .mockReturnValueOnce(chain({ data: islandRow, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));

    await expect(service.remove('island-1', 'user-2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns an empty list when the caller has no memberships', async () => {
    from.mockReturnValueOnce(chain({ data: [], error: null }));

    await expect(service.getMyIslands('user-1')).resolves.toEqual([]);
  });

  it('surfaces membership errors when leaving', async () => {
    from.mockReturnValueOnce(chain({ data: null, error: { message: 'down' } }));

    await expect(service.leave('island-1', 'user-1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
