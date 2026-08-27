import { validate } from 'class-validator';
import { CreateQuickReplyDto } from './create-quick-reply.dto';

describe('CreateQuickReplyDto', () => {
  it('should accept valid payload', async () => {
    const dto = new CreateQuickReplyDto();
    dto.id = 'hello';
    dto.key = 'chat.quickReply.hello';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when id is empty', async () => {
    const dto = new CreateQuickReplyDto();
    dto.id = '';
    dto.key = 'chat.quickReply.hello';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
