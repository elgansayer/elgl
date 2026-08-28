import { validate } from 'class-validator';
import { SimplifyDto } from './simplify.dto';

describe('SimplifyDto', () => {
  it('accepts a non-empty message within the chat message limit', async () => {
    const dto = new SimplifyDto();
    dto.text = 'A message to simplify';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['', 'x'.repeat(4001)])(
    'rejects an invalid message payload',
    async (text) => {
      const dto = new SimplifyDto();
      dto.text = text;

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});
