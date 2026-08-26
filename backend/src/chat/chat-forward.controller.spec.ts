import { BadRequestException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { ChatForwardController } from './chat-forward.controller';
import type { ChatService } from './chat.service';
import type { ForwardMessageDto } from './dto/forward-message.dto';

const MESSAGE_ID = '10000000-0000-4000-8000-000000000001';
const ROOM_ID = '20000000-0000-4000-8000-000000000001';

describe('ChatForwardController', () => {
  const forwardMessage = vi.fn();
  const controller = new ChatForwardController({
    forwardMessage,
  } as unknown as ChatService);

  beforeEach(() => {
    forwardMessage.mockReset();
  });

  it('fails closed when the authenticated principal is absent', async () => {
    const dto: ForwardMessageDto = { room_ids: [ROOM_ID] };

    await expect(
      controller.forwardMessage(null, MESSAGE_ID, dto),
    ).resolves.toBeNull();
    expect(forwardMessage).not.toHaveBeenCalled();
  });

  it('forwards only under the authenticated user identity', async () => {
    const user = { id: 'user-1' } as User;
    const dto: ForwardMessageDto = { room_ids: [ROOM_ID] };
    const saved = [
      {
        id: '30000000-0000-4000-8000-000000000001',
        room_id: ROOM_ID,
        sender_id: user.id,
        message_type: 'text',
        text_content: 'hello',
        is_forwarded: true,
        is_read: false,
        created_at: '2026-08-25T00:00:00.000Z',
      },
    ];
    forwardMessage.mockResolvedValue(saved);

    await expect(
      controller.forwardMessage(user, MESSAGE_ID, dto),
    ).resolves.toEqual(saved);
    expect(forwardMessage).toHaveBeenCalledTimes(1);
    expect(forwardMessage).toHaveBeenCalledWith(user.id, MESSAGE_ID, [ROOM_ID]);
  });

  it('preserves service authorization and abuse failures for the HTTP layer', async () => {
    const user = { id: 'user-1' } as User;
    const dto: ForwardMessageDto = { room_ids: [ROOM_ID] };
    forwardMessage.mockRejectedValue(
      new BadRequestException('Cannot forward spam content.'),
    );

    await expect(
      controller.forwardMessage(user, MESSAGE_ID, dto),
    ).rejects.toThrow('Cannot forward spam content.');
  });
});
