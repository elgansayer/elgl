import { NotFoundException } from '@nestjs/common';
import { ResourceLibraryService } from './resource-library.service';
import { SupabaseService } from '../supabase/supabase.service';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'resource-1',
    title: 'Spanish news',
    description: null,
    url: 'https://example.com/article',
    category: 'news',
    content: null,
    topic: 'news',
    difficulty: 'B1',
    type: 'article',
    created_by: 'user-1',
    created_at: '2026-11-14T00:00:00.000Z',
    updated_at: '2026-11-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('ResourceLibraryService', () => {
  let service: ResourceLibraryService;
  let from: ReturnType<typeof vi.fn>;
  let query: Record<string, ReturnType<typeof vi.fn>>;

  const makeQuery = (response: unknown) => {
    query = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      single: vi.fn().mockResolvedValue(response),
      then: vi.fn((resolve: (value: unknown) => void) => {
        resolve(response);
        return Promise.resolve(response);
      }) as never,
    };
    for (const method of ['select', 'insert', 'update', 'delete', 'eq']) {
      query[method].mockReturnValue(query);
    }
    from = vi.fn().mockReturnValue(query);
    service = new ResourceLibraryService({
      getClient: () => ({ from }),
    } as unknown as SupabaseService);
  };

  it('creates a resource owned by the caller', async () => {
    makeQuery({ data: row(), error: null });

    const result = await service.create('user-1', {
      title: 'Spanish news',
      url: 'https://example.com/article',
      category: 'news',
      topic: 'news',
      difficulty: 'B1',
      type: 'article',
    });

    expect(from).toHaveBeenCalledWith('resource_library');
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Spanish news',
        created_by: 'user-1',
        topic: 'news',
      }),
    );
    expect(result.createdBy).toBe('user-1');
  });

  it('scopes list queries to the caller and optional filters', async () => {
    makeQuery({ data: [row()], error: null });

    const result = await service.findAll('user-1', {
      topic: 'news',
      difficulty: 'B1',
    });

    expect(query.eq).toHaveBeenCalledWith('created_by', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('topic', 'news');
    expect(query.eq).toHaveBeenCalledWith('difficulty', 'B1');
    expect(result).toHaveLength(1);
  });

  it('scopes a single read to the owner', async () => {
    makeQuery({ data: row(), error: null });

    await service.findOne('resource-1', 'user-1');

    expect(query.eq).toHaveBeenCalledWith('id', 'resource-1');
    expect(query.eq).toHaveBeenCalledWith('created_by', 'user-1');
  });

  it('reports a missing resource', async () => {
    makeQuery({ data: null, error: null });

    await expect(service.findOne('missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('propagates database failures', async () => {
    makeQuery({ data: null, error: { message: 'unavailable' } });

    await expect(service.findAll('user-1')).rejects.toEqual({
      message: 'unavailable',
    });
  });

  it('rejects rows with an invalid shape', async () => {
    makeQuery({ data: 'not-a-row', error: null });

    await expect(service.findOne('resource-1', 'user-1')).rejects.toThrow(
      'Invalid resource data',
    );
  });

  it('updates and deletes only the caller-owned resource', async () => {
    makeQuery({ data: row({ title: 'Updated' }), error: null });

    await service.update('resource-1', 'user-1', { title: 'Updated' });

    expect(query.update).toHaveBeenCalledWith({ title: 'Updated' });
    expect(query.eq).toHaveBeenCalledWith('id', 'resource-1');
    expect(query.eq).toHaveBeenCalledWith('created_by', 'user-1');

    makeQuery({ data: null, error: null });
    await service.remove('resource-1', 'user-1');

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('created_by', 'user-1');
  });
});
