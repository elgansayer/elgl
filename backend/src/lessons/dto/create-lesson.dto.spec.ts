import { validate } from 'class-validator';
import { CreateLessonDto } from './create-lesson.dto';

describe('CreateLessonDto', () => {
  let dto: CreateLessonDto;

  beforeEach(() => {
    dto = new CreateLessonDto();
  });

  it('should validate required fields', async () => {
    dto.title = '';
    dto.language_code = '';

    const errors = await validate(dto);
    expect(errors).toHaveLength(2); // Ensure both 'title' and 'language_code' are validated
    expect(errors[0].property).toBe('title');
    expect(errors[1].property).toBe('language_code');
  });

  it('should allow optional fields to be empty', async () => {
    dto.title = 'Sample Lesson';
    dto.language_code = 'en';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should validate content_json as an object', async () => {
    dto.title = 'Sample Lesson';
    dto.language_code = 'en';
    dto.content_json = 'invalid' as unknown as Record<string, unknown>;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('content_json');
  });

  it('should validate difficulty_level as a number', async () => {
    dto.title = 'Sample Lesson';
    dto.language_code = 'en';
    dto.difficulty_level = 'invalid' as unknown as number;

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('difficulty_level');
  });

  it('should validate optional fields with valid values', async () => {
    dto.title = 'Sample Lesson';
    dto.language_code = 'en';
    dto.description = 'This is a sample description.';
    dto.content_json = { key: 'value' };
    dto.difficulty_level = 3;
    dto.cover_image_url = 'https://example.com/image.png';
    dto.audio_url = 'https://example.com/audio.mp3';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
