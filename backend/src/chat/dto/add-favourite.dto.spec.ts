import { validate } from 'class-validator';
import { AddFavouriteDto } from './add-favourite.dto';

const validMessageId = '00000000-0000-4000-8000-000000000001';

const validateDto = (value: Partial<AddFavouriteDto>) => {
  const dto = Object.assign(new AddFavouriteDto(), value);
  return validate(dto);
};

describe('AddFavouriteDto', () => {
  it('accepts a UUID message id without a note', async () => {
    await expect(validateDto({ message_id: validMessageId })).resolves.toEqual(
      [],
    );
  });

  it('accepts a bounded optional note', async () => {
    await expect(
      validateDto({ message_id: validMessageId, note_text: 'Useful phrase' }),
    ).resolves.toEqual([]);
  });

  it('rejects malformed message identifiers', async () => {
    const errors = await validateDto({ message_id: 'not-a-message-id' });
    expect(errors.some((error) => error.property === 'message_id')).toBe(true);
  });

  it('rejects notes longer than 500 characters', async () => {
    const errors = await validateDto({
      message_id: validMessageId,
      note_text: 'a'.repeat(501),
    });
    expect(errors.some((error) => error.property === 'note_text')).toBe(true);
  });
});
