import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseService } from '../supabase/supabase.service';
import type { SafetyService } from '../safety/safety.service';
import type { LinkPreviewService } from '../link-preview/link-preview.service';
import type { SpamDetectionService } from '../spam-detection/spam-detection.service';
import type { XpService } from '../xp/xp.service';
import type { UsersService } from '../users/users.service';
import type { CentrifugoService } from './centrifugo.service';
import type { ChatLlmService } from './chat-llm.service';
import { ChatService } from './chat.service';
import type { ChatMessage } from './interfaces/chat-message.interface';
import type { SystemMessageService } from './services/system-message.service';

function buildService(
  originalMessage: Record<string, unknown> | null,
  error: unknown = null,
): ChatService {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: originalMessage, error }),
  };
  const client = {
    from: vi.fn().mockReturnValue(query),
  };

  return new ChatService(
    { getClient: () => client } as unknown as SupabaseService,
    {} as CentrifugoService,
    undefined,
    { emit: vi.fn() } as unknown as EventEmitter2,
    {} as SafetyService,
    {} as LinkPreviewService,
    {} as SpamDetectionService,
    {} as ChatLlmService,
    {} as SystemMessageService,
    {} as XpService,
    {} as UsersService,
    { get: vi.fn() } as unknown as ConfigService,
  );
}

describe('group chat correction contract', () => {
  it('threads a correction to the original text message in the same room', async () => {
    const service = buildService({
      room_id: 'group-room',
      text_content: 'I goed home',
      sender_id: 'learner-a',
      message_type: 'text',
    });
    const correction = {
      id: 'correction-1',
      room_id: 'group-room',
      sender_id: 'learner-b',
      message_type: 'correction',
      correction_payload: {
        original: 'I goed home',
        corrected: 'I went home',
        explanation: 'Went is the past tense of go.',
      },
      reply_to_id: 'message-1',
    } as unknown as ChatMessage;
    const sendMessage = vi
      .spyOn(service, 'sendMessage')
      .mockResolvedValue(correction);

    await expect(
      service.correctMessage(
        'learner-b',
        'message-1',
        'I went home',
        'Went is the past tense of go.',
      ),
    ).resolves.toBe(correction);

    expect(sendMessage).toHaveBeenCalledWith('learner-b', {
      room_id: 'group-room',
      message_type: 'correction',
      text_content: undefined,
      media_url: undefined,
      correction_payload: {
        original: 'I goed home',
        corrected: 'I went home',
        explanation: 'Went is the past tense of go.',
      },
      reply_to_id: 'message-1',
      correction_request_payload: undefined,
      status_reply_payload: undefined,
    });
  });

  it('preserves an omitted explanation for server-side enrichment', async () => {
    const service = buildService({
      room_id: 'group-room',
      text_content: 'She go yesterday',
      sender_id: 'learner-a',
      message_type: 'text',
    });
    const correction = {
      id: 'correction-2',
      room_id: 'group-room',
      sender_id: 'learner-b',
      message_type: 'correction',
    } as unknown as ChatMessage;
    const sendMessage = vi
      .spyOn(service, 'sendMessage')
      .mockResolvedValue(correction);

    await service.correctMessage(
      'learner-b',
      'message-2',
      'She went yesterday',
    );

    expect(sendMessage).toHaveBeenCalledWith(
      'learner-b',
      expect.objectContaining({
        reply_to_id: 'message-2',
        correction_payload: {
          original: 'She go yesterday',
          corrected: 'She went yesterday',
          explanation: undefined,
        },
      }),
    );
  });

  it('rejects correction attempts for non-text group messages', async () => {
    const service = buildService({
      room_id: 'group-room',
      text_content: 'Voice message',
      sender_id: 'learner-a',
      message_type: 'voice',
    });
    const sendMessage = vi.spyOn(service, 'sendMessage');

    await expect(
      service.correctMessage('learner-b', 'voice-1', 'Corrected text'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('fails when the referenced group message no longer exists', async () => {
    const service = buildService(null, { message: 'not found' });
    const sendMessage = vi.spyOn(service, 'sendMessage');

    await expect(
      service.correctMessage('learner-b', 'missing-message', 'Corrected text'),
    ).rejects.toThrow('Original message not found');
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
