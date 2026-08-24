import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFlashcardDto, UpdateSrsDto } from './flashcard.dto';

describe('CreateFlashcardDto', () => {
  it('should accept a valid payload', async () => {
    const dto = new CreateFlashcardDto();
    dto.word_token = 'bonjour';
    dto.translation = 'hello';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept a payload with all optional fields', async () => {
    const dto = new CreateFlashcardDto();
    dto.word_token = 'bonjour';
    dto.translation = 'hello';
    dto.original_context = 'Bonjour le monde';
    dto.definition = 'A greeting in French';
    dto.pronunciation_url = 'https://audio.example.com/bonjour.mp3';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should trim user text before validation and persistence', async () => {
    const dto = plainToInstance(CreateFlashcardDto, {
      word_token: '  Bonjour  ',
      translation: '  hello  ',
      original_context: '  Bonjour le monde.  ',
      definition: '  A greeting.  ',
      pronunciation_url: '  https://audio.example.com/bonjour.mp3  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      word_token: 'Bonjour',
      translation: 'hello',
      original_context: 'Bonjour le monde.',
      definition: 'A greeting.',
      pronunciation_url: 'https://audio.example.com/bonjour.mp3',
    });
  });

  it('should fail when word_token is empty', async () => {
    const dto = new CreateFlashcardDto();
    dto.word_token = '';
    dto.translation = 'hello';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a whitespace-only word token after transformation', async () => {
    const dto = plainToInstance(CreateFlashcardDto, {
      word_token: '   ',
      translation: 'hello',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'word_token')).toBe(true);
  });

  it('should fail when word_token is missing', async () => {
    const dto = new CreateFlashcardDto();
    dto.translation = 'hello';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when translation is empty', async () => {
    const dto = new CreateFlashcardDto();
    dto.word_token = 'bonjour';
    dto.translation = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a whitespace-only translation after transformation', async () => {
    const dto = plainToInstance(CreateFlashcardDto, {
      word_token: 'bonjour',
      translation: '   ',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'translation')).toBe(true);
  });

  it('should fail when translation is missing', async () => {
    const dto = new CreateFlashcardDto();
    dto.word_token = 'bonjour';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when word_token is not a string', async () => {
    const dto = Object.assign(new CreateFlashcardDto(), { word_token: 12345 });
    dto.translation = 'hello';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when translation is not a string', async () => {
    const dto = Object.assign(new CreateFlashcardDto(), { translation: 12345 });
    dto.word_token = 'bonjour';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject non-HTTP pronunciation URLs', async () => {
    const dto = plainToInstance(CreateFlashcardDto, {
      word_token: 'bonjour',
      translation: 'hello',
      pronunciation_url: 'javascript:alert(1)',
    });

    const errors = await validate(dto);
    expect(
      errors.some((error) => error.property === 'pronunciation_url'),
    ).toBe(true);
  });

  it('should enforce bounded user-controlled text fields', async () => {
    const dto = plainToInstance(CreateFlashcardDto, {
      word_token: 'x'.repeat(201),
      translation: 'y'.repeat(501),
      original_context: 'z'.repeat(1001),
      definition: 'd'.repeat(1001),
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'word_token',
        'translation',
        'original_context',
        'definition',
      ]),
    );
  });
});

describe('UpdateSrsDto', () => {
  it('should accept a valid quality rating (0-5)', async () => {
    for (const quality of [0, 1, 2, 3, 4, 5]) {
      const dto = new UpdateSrsDto();
      dto.quality = quality;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });

  it('should fail when quality is below 0', async () => {
    const dto = new UpdateSrsDto();
    dto.quality = -1;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when quality is above 5', async () => {
    const dto = new UpdateSrsDto();
    dto.quality = 6;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when quality is not an integer', async () => {
    const dto = Object.assign(new UpdateSrsDto(), { quality: 3.5 });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when quality is missing', async () => {
    const dto = new UpdateSrsDto();

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when quality is not a number', async () => {
    const dto = Object.assign(new UpdateSrsDto(), { quality: 'great' });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
