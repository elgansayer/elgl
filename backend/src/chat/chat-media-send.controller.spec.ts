import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SendChatMediaMessageDto } from '../media/dto/send-chat-media-message.dto';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatMediaSendController } from './chat-media-send.controller';

describe('ChatMediaSendController', () => {
  const send = vi.fn();
  let controller: ChatMediaSendController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatMediaSendController],
      providers: [{ provide: ChatMediaMessageService, useValue: { send } }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ChatMediaSendController);
  });

  it('requires an authenticated session for every route', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ChatMediaSendController),
    ).toContain(SupabaseAuthGuard);
  });

  it('sends an uploaded doodle as the authenticated user and returns the persisted message', async () => {
    const message = {
      id: 'doodle-1',
      room_id: 'room-1',
      sender_id: 'user-1',
      message_type: 'doodle',
    };
    send.mockResolvedValue(message);
    const dto = Object.assign(new SendChatMediaMessageDto(), {
      roomId: 'room-1',
      mediaKind: 'doodle',
      objectKey:
        'chat-media/user-1/doodle/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.png',
    });

    await expect(
      controller.sendUploadedMedia({ user: { id: 'user-1' } }, dto),
    ).resolves.toBe(message);
    expect(send).toHaveBeenCalledWith('user-1', dto);
  });

  it('propagates ownership rejections from the media message service', async () => {
    send.mockRejectedValue(new Error('Chat media object does not belong'));

    await expect(
      controller.sendUploadedMedia(
        { user: { id: 'user-1' } },
        new SendChatMediaMessageDto(),
      ),
    ).rejects.toThrow('Chat media object does not belong');
  });
});
