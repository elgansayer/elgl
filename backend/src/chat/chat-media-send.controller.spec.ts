import { ChatMediaSendController } from './chat-media-send.controller';
import { ChatMediaMessageService } from './chat-media-message.service';
import { SendChatMediaMessageDto } from '../media/dto/send-chat-media-message.dto';

describe('ChatMediaSendController', () => {
  const message = { id: 'message-1' };
  const service = {
    send: vi.fn().mockResolvedValue(message),
  };
  const controller = new ChatMediaSendController(
    service as unknown as ChatMediaMessageService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the uploaded media on behalf of the authenticated request user', async () => {
    const dto = {
      room_id: '11111111-1111-4111-8111-111111111111',
      media_url: 'https://cdn.example.com/photo.jpg',
      message_type: 'image',
    } as unknown as SendChatMediaMessageDto;

    await expect(
      controller.sendUploadedMedia({ user: { id: 'user-1' } }, dto),
    ).resolves.toEqual(message);
    expect(service.send).toHaveBeenCalledWith('user-1', dto);
  });
});
