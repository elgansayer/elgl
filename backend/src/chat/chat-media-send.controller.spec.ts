import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Mock } from 'vitest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatMediaSendController } from './chat-media-send.controller';

describe('ChatMediaSendController', () => {
  let controller: ChatMediaSendController;
  let send: Mock;

  beforeEach(async () => {
    send = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatMediaSendController],
      providers: [
        {
          provide: ChatMediaMessageService,
          useValue: { send },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ChatMediaSendController);
  });

  it('requires Supabase authentication for every media send', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ChatMediaSendController,
    ) as unknown[] | undefined;

    expect(guards).toContain(SupabaseAuthGuard);
  });

  it('delegates the validated owned-object request with the authenticated user', async () => {
    const dto = {
      roomId: 'room-1',
      mediaKind: 'video' as const,
      presentation: 'instant_video' as const,
      objectKey:
        'chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.webm',
    };
    const message = { id: 'video-note-1' };
    send.mockResolvedValue(message);

    await expect(
      controller.sendUploadedMedia({ user: { id: 'user-1' } }, dto),
    ).resolves.toEqual(message);
    expect(send).toHaveBeenCalledWith('user-1', dto);
  });

  it('propagates service failures without masking the API error', async () => {
    const failure = new Error('delivery state unavailable');
    send.mockRejectedValue(failure);

    await expect(
      controller.sendUploadedMedia(
        { user: { id: 'user-1' } },
        {
          roomId: 'room-1',
          mediaKind: 'video',
          objectKey:
            'chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.webm',
        },
      ),
    ).rejects.toBe(failure);
  });
});
