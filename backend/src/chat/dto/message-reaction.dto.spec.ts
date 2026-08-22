import { validate } from 'class-validator';
import { MESSAGE_REACTION_EMOJIS, SetMessageReactionDto } from './message-reaction.dto';

describe('SetMessageReactionDto', () => {
  it.each(MESSAGE_REACTION_EMOJIS)('accepts supported emoji %s', async (emoji) => {
    const dto = new SetMessageReactionDto();
    dto.emoji = emoji;
    dto.active = true;

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects arbitrary emoji values', async () => {
    const dto = Object.assign(new SetMessageReactionDto(), {
      emoji: '🔥',
      active: true,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'emoji')).toBe(true);
  });

  it('requires an explicit boolean desired state', async () => {
    const dto = Object.assign(new SetMessageReactionDto(), {
      emoji: '👍',
      active: 'true',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'active')).toBe(true);
  });
});
