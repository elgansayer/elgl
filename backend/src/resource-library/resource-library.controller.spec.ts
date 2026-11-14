import type { User } from '@supabase/supabase-js';
import { ResourceLibraryController } from './resource-library.controller';
import { ResourceLibraryService } from './resource-library.service';

describe('ResourceLibraryController', () => {
  const user = { id: 'user-1' } as unknown as User;
  const resource = {
    id: 'resource-1',
    title: 'Article',
    url: 'https://example.com',
    createdBy: 'user-1',
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
  };
  const service = {
    create: vi.fn().mockResolvedValue(resource),
    findAll: vi.fn().mockResolvedValue([resource]),
    findOne: vi.fn().mockResolvedValue(resource),
    update: vi.fn().mockResolvedValue(resource),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new ResourceLibraryController(
    service as unknown as ResourceLibraryService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a resource for the authenticated caller', async () => {
    const dto = { title: 'Article', url: 'https://example.com' };

    await expect(controller.create(user, dto)).resolves.toEqual(resource);
    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('passes topic and difficulty filters through', async () => {
    await expect(controller.findAll(user, 'news', 'B1')).resolves.toEqual([
      resource,
    ]);
    expect(service.findAll).toHaveBeenCalledWith('user-1', {
      topic: 'news',
      difficulty: 'B1',
    });
  });

  it('reads, updates and deletes with the caller scope', async () => {
    await expect(controller.findOne(user, 'resource-1')).resolves.toEqual(
      resource,
    );
    await controller.update(user, 'resource-1', { title: 'Updated' });
    await controller.remove(user, 'resource-1');

    expect(service.findOne).toHaveBeenCalledWith('resource-1', 'user-1');
    expect(service.update).toHaveBeenCalledWith('resource-1', 'user-1', {
      title: 'Updated',
    });
    expect(service.remove).toHaveBeenCalledWith('resource-1', 'user-1');
  });
});
