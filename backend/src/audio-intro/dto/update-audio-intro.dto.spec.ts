import { validate } from 'class-validator';
import { UpdateAudioIntroDto } from './update-audio-intro.dto';

describe('UpdateAudioIntroDto', () => {
  let dto: UpdateAudioIntroDto;

  beforeEach(() => {
    dto = new UpdateAudioIntroDto();
  });

  it('should validate successfully with a valid audio_url', async () => {
    dto.audio_url = 'https://example.com/audio.mp3';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation if audio_url is empty', async () => {
    dto.audio_url = '';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('audio_url');
    expect(errors[0].constraints?.isNotEmpty).toBeDefined();
  });

  it('should fail validation if audio_url is not a string', async () => {
    // @ts-expect-error: Testing invalid type
    dto.audio_url = 123;
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('audio_url');
    expect(errors[0].constraints?.isString).toBeDefined();
  });
});
