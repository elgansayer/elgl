import { LanguageIslandsController } from './language-islands.controller';
import { LanguageIslandsService } from './language-islands.service';

describe('LanguageIslandsController', () => {
  const user = { id: 'user-1' } as never;
  const island = { id: 'island-1', host_id: 'user-1' };
  const service = {
    list: vi.fn().mockResolvedValue([island]),
    getMyIslands: vi.fn().mockResolvedValue([island]),
    getById: vi.fn().mockResolvedValue(island),
    create: vi.fn().mockResolvedValue(island),
    update: vi.fn().mockResolvedValue(island),
    remove: vi.fn().mockResolvedValue(undefined),
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new LanguageIslandsController(
    service as unknown as LanguageIslandsService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the optional caller id into listing', async () => {
    await expect(controller.list(user, {})).resolves.toEqual([island]);
    expect(service.list).toHaveBeenCalledWith({}, 'user-1');
  });

  it('returns an empty list for anonymous island lists', async () => {
    await expect(controller.getMyIslands(null)).resolves.toEqual([]);
    expect(service.getMyIslands).not.toHaveBeenCalled();
  });

  it('delegates create, update, join and leave with the caller id', async () => {
    const createDto = { name: 'Spanish Corner', language_pair: 'es-en' };
    await controller.create(user, createDto);
    await controller.update(user, 'island-1', { name: 'New' });
    await controller.join(user, 'island-1');
    await controller.leave(user, 'island-1');
    await controller.remove(user, 'island-1');
    await controller.getById('island-1');

    expect(service.create).toHaveBeenCalledWith(createDto, 'user-1');
    expect(service.update).toHaveBeenCalledWith(
      'island-1',
      { name: 'New' },
      'user-1',
    );
    expect(service.join).toHaveBeenCalledWith('island-1', 'user-1');
    expect(service.leave).toHaveBeenCalledWith('island-1', 'user-1');
    expect(service.remove).toHaveBeenCalledWith('island-1', 'user-1');
    expect(service.getById).toHaveBeenCalledWith('island-1');
  });
});
