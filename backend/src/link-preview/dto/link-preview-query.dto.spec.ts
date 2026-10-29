import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LinkPreviewQueryDto } from './link-preview-query.dto';

describe('LinkPreviewQueryDto', () => {
  it('validates a valid url string', async () => {
    const dto = plainToInstance(LinkPreviewQueryDto, {
      url: 'https://example.com/article',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty url', async () => {
    const dto = plainToInstance(LinkPreviewQueryDto, {
      url: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an overlong url exceeding 2048 characters', async () => {
    const dto = plainToInstance(LinkPreviewQueryDto, {
      url: `https://example.com/${'a'.repeat(2048)}`,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
