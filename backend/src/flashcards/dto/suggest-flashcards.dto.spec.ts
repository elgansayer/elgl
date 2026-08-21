import { validate } from 'class-validator';
import { SuggestFlashcardsDto } from './suggest-flashcards.dto';

describe('SuggestFlashcardsDto', () => {
  it('should accept a valid payload with only required fields', async () => {
    const dto = new SuggestFlashcardsDto();
    dto.message = 'Hello world';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept a valid payload with all optional fields', async () => {
    const dto = new SuggestFlashcardsDto();
    dto.message = 'Bonjour le monde';
    dto.user_id = 'user-1';
    dto.target_language = 'fr';
    dto.exclude_known = true;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept optional fields as undefined', async () => {
    const dto = new SuggestFlashcardsDto();
    dto.message = 'Hello';

    // user_id, target_language, exclude_known are all optional
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when message is missing', async () => {
    const dto = new SuggestFlashcardsDto();

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when message is not a string', async () => {
    const dto = Object.assign(new SuggestFlashcardsDto(), { message: 12345 });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when exclude_known is not a boolean', async () => {
    const dto = Object.assign(new SuggestFlashcardsDto(), {
      message: 'Hello',
      exclude_known: 'yes',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept exclude_known as false', async () => {
    const dto = new SuggestFlashcardsDto();
    dto.message = 'Hello';
    dto.exclude_known = false;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
