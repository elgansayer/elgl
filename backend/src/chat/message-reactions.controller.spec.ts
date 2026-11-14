import type { User } from '@supabase/supabase-js';
import { MessageReactionsController } from './message-reactions.controller';
import { MessageReactionsService } from './message-reactions.service';

describe('MessageReactionsController', () => {
  const user = { id: 'user-1' } as unknown as User;
  const service = {
    getRoomReactions: vi.fn().mockResolvedValue([{ emoji: '👍' }]),
    setReaction: vi.fn().mockResolvedValue({ emoji: '👍', active: true }),
  };
  const controller = new MessageReactionsController(
    service as unknown as MessageReactionsService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the room reaction summary for the caller', async () => {
    await expect(controller.getRoomReactions(user, 'room-1')).resolves.toEqual([
      { emoji: '👍' },
    ]);
    expect(service.getRoomReactions).toHaveBeenCalledWith('user-1', 'room-1');
  });

  it('forwards the reaction toggle to the service', async () => {
    await expect(
      controller.setReaction(user, 'message-1', {
        emoji: '👍',
        active: true,
      }),
    ).resolves.toEqual({ emoji: '👍', active: true });
    expect(service.setReaction).toHaveBeenCalledWith(
      'user-1',
      'message-1',
      '👍',
      true,
    );
  });
});
