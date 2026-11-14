import type { User } from '@supabase/supabase-js';
import { ChatFoldersController } from './chat-folders.controller';
import { ChatFoldersService } from './chat-folders.service';

describe('ChatFoldersController', () => {
  const user = { id: 'user-1' } as unknown as User;
  const roomId = '11111111-1111-4111-8111-111111111111';
  const rooms = [{ id: 'room-1' }];
  const service = {
    getArchivedRooms: vi.fn().mockResolvedValue(rooms),
    archiveRoom: vi.fn().mockResolvedValue(undefined),
    unarchiveRoom: vi.fn().mockResolvedValue(undefined),
    getHiddenRooms: vi.fn().mockResolvedValue(rooms),
  };
  const controller = new ChatFoldersController(
    service as unknown as ChatFoldersService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty folders without a session', async () => {
    await expect(controller.getArchivedRooms(null)).resolves.toEqual([]);
    await expect(controller.getHiddenRooms(null)).resolves.toEqual([]);
    await expect(controller.archiveRoom(null, roomId)).resolves.toBeNull();
    expect(service.getArchivedRooms).not.toHaveBeenCalled();
  });

  it('delegates folder reads and mutations to the caller-scoped service', async () => {
    await expect(controller.getArchivedRooms(user)).resolves.toEqual(rooms);
    await expect(controller.getHiddenRooms(user)).resolves.toEqual(rooms);
    await expect(controller.archiveRoom(user, roomId)).resolves.toEqual({
      success: true,
    });
    await expect(controller.unarchiveRoom(user, roomId)).resolves.toEqual({
      success: true,
    });

    expect(service.getArchivedRooms).toHaveBeenCalledWith('user-1');
    expect(service.getHiddenRooms).toHaveBeenCalledWith('user-1');
    expect(service.archiveRoom).toHaveBeenCalledWith('user-1', roomId);
    expect(service.unarchiveRoom).toHaveBeenCalledWith('user-1', roomId);
  });
});
