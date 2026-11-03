import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChatMediaUploadDto } from './chat-media-upload.dto';

const validDoodleRequest = {
  filename: 'doodle.png',
  contentType: 'image/png',
  quality: 'standard',
  sizeBytes: 48_000,
  purpose: 'doodle',
};

async function propertiesWithErrors(
  payload: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(ChatMediaUploadDto, payload));
  return errors.map((error) => error.property).sort();
}

describe('ChatMediaUploadDto', () => {
  it('accepts a doodle upload intent', async () => {
    await expect(propertiesWithErrors(validDoodleRequest)).resolves.toEqual([]);
  });

  it('keeps the purpose optional so existing photo and video clients are unaffected', async () => {
    const { purpose: _purpose, ...photoRequest } = validDoodleRequest;

    await expect(
      propertiesWithErrors({ ...photoRequest, contentType: 'image/jpeg' }),
    ).resolves.toEqual([]);
  });

  it.each(['photo', 'video', 'DOODLE', '', 7])(
    'rejects the unknown purpose %j',
    async (purpose) => {
      await expect(
        propertiesWithErrors({ ...validDoodleRequest, purpose }),
      ).resolves.toEqual(['purpose']);
    },
  );

  it('still bounds the declared size and metadata', async () => {
    await expect(
      propertiesWithErrors({
        ...validDoodleRequest,
        filename: 'f'.repeat(256),
        contentType: 'c'.repeat(129),
        sizeBytes: 25 * 1024 * 1024 + 1,
      }),
    ).resolves.toEqual(['contentType', 'filename', 'sizeBytes']);
    await expect(
      propertiesWithErrors({ ...validDoodleRequest, sizeBytes: 0 }),
    ).resolves.toEqual(['sizeBytes']);
  });
});
