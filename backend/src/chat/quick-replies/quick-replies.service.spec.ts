import { QuickRepliesService } from './quick-replies.service';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';

describe('QuickRepliesService', () => {
  let service: QuickRepliesService;

  beforeEach(() => {
    service = new QuickRepliesService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return an array of quick replies', () => {
    const replies = service.getQuickReplies();
    expect(Array.isArray(replies)).toBe(true);
    expect(replies.length).toBeGreaterThan(0);
    expect(replies[0]).toHaveProperty('id');
    expect(replies[0]).toHaveProperty('key');
  });

  it('should add a new quick reply via create', () => {
    const dto = new CreateQuickReplyDto();
    dto.id = 'test-reply';
    dto.key = 'chat.quickReply.testReply';
    const newReply = service.createQuickReply(dto);
    expect(newReply).toEqual({
      id: 'test-reply',
      key: 'chat.quickReply.testReply',
    });
    expect(service.getQuickReplies()).toContainEqual(newReply);
  });
});
