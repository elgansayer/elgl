import { validate } from 'class-validator';
import { PresignedMediaUploadDto } from './presigned-media-upload.dto';

describe('PresignedMediaUploadDto', () => {
  async function errorsFor(filename: string, contentType: string) {
    const dto = Object.assign(new PresignedMediaUploadDto(), {
      filename,
      contentType,
    });
    return validate(dto);
  }

  it('accepts normal audio upload metadata', async () => {
    await expect(
      errorsFor('voice.webm', 'audio/webm;codecs=opus'),
    ).resolves.toHaveLength(0);
  });

  it('rejects empty upload metadata', async () => {
    const errors = await errorsFor('', '');
    expect(errors.map((error) => error.property).sort()).toEqual([
      'contentType',
      'filename',
    ]);
  });

  it('rejects oversized filename and content-type metadata', async () => {
    const errors = await errorsFor('a'.repeat(256), 'a'.repeat(129));
    expect(errors.map((error) => error.property).sort()).toEqual([
      'contentType',
      'filename',
    ]);
  });
});
