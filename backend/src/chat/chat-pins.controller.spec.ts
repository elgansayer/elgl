import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatPinsController } from './chat-pins.controller';
import { ChatPinsService } from './chat-pins.service';

describe('ChatPinsController', () => {
  let controller: ChatPinsController;
  const roomId = '22222222-2222-4222-8222-222222222222';
  const user = { id: '11111111-1111-4111-8111-111111111111' } as User;
  const service = {
    getPinnedRoomIds: vi.fn(),
    setPinned: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChatPinsController],
      providers: [{ provide: ChatPinsService, useValue: service }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();
    controller = moduleRef.get(ChatPinsController);
  });

  it('returns only the authenticated users pin list', async () => {
    service.getPinnedRoomIds.mockResolvedValue([roomId]);
    await expect(controller.getPinnedRoomIds(user)).resolves.toEqual([roomId]);
    expect(service.getPinnedRoomIds).toHaveBeenCalledWith(user.id);
  });

  it('forwards a typed pin mutation with the authenticated user id', async () => {
    service.setPinned.mockResolvedValue({ room_id: roomId, is_pinned: true });
    await expect(
      controller.setPinned(user, roomId, { is_pinned: true }),
    ).resolves.toEqual({
      room_id: roomId,
      is_pinned: true,
    });
    expect(service.setPinned).toHaveBeenCalledWith(user.id, roomId, true);
  });
});
