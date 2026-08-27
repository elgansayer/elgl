import { QuickRepliesController } from './quick-replies.controller';
import { QuickRepliesService } from './quick-replies.service';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';

describe('QuickRepliesController', () => {
  let controller: QuickRepliesController;
  let service: QuickRepliesService;

  beforeEach(() => {
    service = new QuickRepliesService();
    controller = new QuickRepliesController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return quick replies', () => {
    const replies = controller.getQuickReplies();
    expect(Array.isArray(replies)).toBe(true);
    expect(replies.length).toBeGreaterThan(0);
  });

  it('should create a quick reply', () => {
    const dto = new CreateQuickReplyDto();
    dto.id = 'new-reply';
    dto.key = 'chat.quickReply.newReply';
    const created = controller.createQuickReply(dto);
    expect(created).toEqual({
      id: 'new-reply',
      key: 'chat.quickReply.newReply',
    });
  });
});
