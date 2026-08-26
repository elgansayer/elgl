import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { ChatEditController } from './chat-edit.controller';
import type { ChatService } from './chat.service';
import type { ChatMessage } from './interfaces/chat-message.interface';

function authenticatedUser(id = 'user-1'): User {
  return { id } as User;
}

describe('ChatEditController', () => {
  it('forwards authenticated edits to the authoritative ChatService policy', async () => {
    const edited = {
      id: 'message-1',
      room_id: 'room-1',
      sender_id: 'user-1',
      message_type: 'text',
      text_content: 'edited text',
      is_read: false,
      is_edited: true,
      edited_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as ChatMessage;
    const editMessage = vi.fn<ChatService['editMessage']>();
    editMessage.mockResolvedValue(edited);
    const controller = new ChatEditController({ editMessage } as unknown as ChatService);

    await expect(
      controller.editMessage(authenticatedUser(), 'message-1', {
        text_content: 'edited text',
      }),
    ).resolves.toBe(edited);

    expect(editMessage).toHaveBeenCalledTimes(1);
    expect(editMessage).toHaveBeenCalledWith('user-1', 'message-1', {
      text_content: 'edited text',
    });
  });

  it('fails closed when the authenticated principal is missing', async () => {
    const editMessage = vi.fn<ChatService['editMessage']>();
    const controller = new ChatEditController({ editMessage } as unknown as ChatService);

    await expect(
      controller.editMessage(null, 'message-1', { text_content: 'edited text' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(editMessage).not.toHaveBeenCalled();
  });

  it('does not hide service ownership or edit-window failures', async () => {
    const editMessage = vi.fn<ChatService['editMessage']>();
    editMessage.mockRejectedValue(
      new ForbiddenException('You can only edit your own messages'),
    );
    const controller = new ChatEditController({ editMessage } as unknown as ChatService);

    await expect(
      controller.editMessage(authenticatedUser('other-user'), 'message-1', {
        text_content: 'edited text',
      }),
    ).rejects.toThrow('You can only edit your own messages');
  });
});
