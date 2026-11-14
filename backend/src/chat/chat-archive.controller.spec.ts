import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { ChatArchiveController } from './chat-archive.controller';
import { ChatArchiveService } from './chat-archive.service';

describe('ChatArchiveController', () => {
  const user = { id: 'user-1' } as unknown as User;
  const roomId = '11111111-1111-4111-8111-111111111111';
  const service = {
    getArchivedRoomIds: vi.fn().mockResolvedValue(['room-1']),
    archiveRoom: vi.fn().mockResolvedValue(undefined),
    unarchiveRoom: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new ChatArchiveController(
    service as unknown as ChatArchiveService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated reads', async () => {
    await expect(controller.getArchivedRoomIds(null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(service.getArchivedRoomIds).not.toHaveBeenCalled();
  });

  it('returns archived room ids for the caller', async () => {
    await expect(controller.getArchivedRoomIds(user)).resolves.toEqual([
      'room-1',
    ]);
    expect(service.getArchivedRoomIds).toHaveBeenCalledWith('user-1');
  });

  it('archives and unarchives the requested room for the caller', async () => {
    await expect(controller.archiveRoom(user, roomId)).resolves.toEqual({
      success: true,
    });
    await expect(controller.unarchiveRoom(null, roomId)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(service.archiveRoom).toHaveBeenCalledWith('user-1', roomId);
    expect(service.unarchiveRoom).not.toHaveBeenCalled();
  });
});
