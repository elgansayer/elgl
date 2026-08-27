import { validate } from 'class-validator';
import { CreateMomentDto, CreateCommentDto } from './moment.dto';

describe('CreateMomentDto', () => {
  it('should accept a valid DTO with only required fields', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept a DTO with all optional fields populated', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.text_content = 'This is a test moment';
    dto.media_urls = ['https://example.com/image.jpg'];
    dto.media_type = 'images';
    dto.post_type = 'language_question';
    dto.question_text = 'What does this word mean?';
    dto.question_options = ['Option A', 'Option B'];
    dto.correct_answer = 'Option A';
    dto.voice_note_url = 'https://example.com/audio.mp3';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail when target_language is missing', async () => {
    const dto = new CreateMomentDto();

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'target_language');
    expect(error).toBeDefined();
  });

  it('should fail when target_language is empty', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = '';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'target_language');
    expect(error).toBeDefined();
  });

  it('should fail when text_content exceeds 5000 characters', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.text_content = 'a'.repeat(5001);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'text_content');
    expect(error).toBeDefined();
  });

  it('should fail when media_urls is not an array', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.media_urls = 'not-an-array' as unknown as string[];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'media_urls');
    expect(error).toBeDefined();
  });

  it('should fail when media_urls contains a non-string element', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.media_urls = [
      'https://example.com/image.jpg',
      123,
    ] as unknown as string[];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'media_urls');
    expect(error).toBeDefined();
  });

  it('should fail when media_type is not one of the allowed values', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.media_type = 'video' as unknown as 'none' | 'images' | 'audio';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'media_type');
    expect(error).toBeDefined();
  });

  it('should accept each allowed media_type value', async () => {
    for (const mediaType of ['none', 'images', 'audio'] as const) {
      const dto = new CreateMomentDto();
      dto.target_language = 'en';
      dto.media_type = mediaType;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    }
  });

  it('should fail when post_type is not one of the allowed values', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.post_type = 'poll' as unknown as
      'moment' | 'question' | 'language_question';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'post_type');
    expect(error).toBeDefined();
  });

  it('should accept each allowed post_type value', async () => {
    for (const postType of [
      'moment',
      'question',
      'language_question',
    ] as const) {
      const dto = new CreateMomentDto();
      dto.target_language = 'en';
      dto.post_type = postType;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    }
  });

  it('should fail when question_text exceeds 5000 characters', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.question_text = 'a'.repeat(5001);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'question_text');
    expect(error).toBeDefined();
  });

  it('should fail when question_options is not an array', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.question_options = 'not-an-array' as unknown as string[];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'question_options');
    expect(error).toBeDefined();
  });

  it('should fail when question_options contains a non-string element', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.question_options = ['Option A', 42] as unknown as string[];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'question_options');
    expect(error).toBeDefined();
  });

  it('should fail when correct_answer is not a string', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.correct_answer = 123 as unknown as string;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'correct_answer');
    expect(error).toBeDefined();
  });

  it('should fail when voice_note_url is not a string', async () => {
    const dto = new CreateMomentDto();
    dto.target_language = 'en';
    dto.voice_note_url = 123 as unknown as string;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'voice_note_url');
    expect(error).toBeDefined();
  });
});

describe('CreateCommentDto', () => {
  it('should accept an empty DTO since all fields are optional', async () => {
    const dto = new CreateCommentDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept a DTO with all optional fields populated', async () => {
    const dto = new CreateCommentDto();
    dto.text_content = 'This is a test comment';
    dto.correction_payload = {
      original: 'She go to school',
      corrected: 'She goes to school',
      explanation: 'Third person singular requires "goes"',
    };
    dto.parent_comment_id = 'comment-123';
    dto.reply_to_user_id = 'user-456';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should accept correction_payload without the optional explanation', async () => {
    const dto = new CreateCommentDto();
    dto.correction_payload = {
      original: 'She go to school',
      corrected: 'She goes to school',
    };

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should fail when text_content exceeds 2000 characters', async () => {
    const dto = new CreateCommentDto();
    dto.text_content = 'a'.repeat(2001);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'text_content');
    expect(error).toBeDefined();
  });

  it('should fail when parent_comment_id is not a string', async () => {
    const dto = new CreateCommentDto();
    dto.parent_comment_id = 123 as unknown as string;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'parent_comment_id');
    expect(error).toBeDefined();
  });

  it('should fail when reply_to_user_id is not a string', async () => {
    const dto = new CreateCommentDto();
    dto.reply_to_user_id = 123 as unknown as string;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const error = errors.find((e) => e.property === 'reply_to_user_id');
    expect(error).toBeDefined();
  });
});
