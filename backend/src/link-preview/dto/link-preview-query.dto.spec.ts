import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LinkPreviewQueryDto } from './link-preview-query.dto';

describe('LinkPreviewQueryDto', () => {
  it('accepts valid https and http URLs', async () => {
    const validTargets = [
      'https://example.com',
      'https://example.com/article?id=123',
      'http://example.org/path/to/resource',
      'https://subdomain.example.co.uk/news#section',
    ];

    for (const url of validTargets) {
      const dto = plainToInstance(LinkPreviewQueryDto, { url });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an empty URL string', async () => {
    const dto = plainToInstance(LinkPreviewQueryDto, { url: '' });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('url');
  });

  it('rejects a missing URL', async () => {
    const dto = plainToInstance(LinkPreviewQueryDto, {});
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('url');
  });

  it('rejects URLs with disallowed protocols or without protocols', async () => {
    const invalidTargets = [
      'ftp://example.com/file.txt',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'example.com/no-protocol',
      'just a string',
    ];

    for (const url of invalidTargets) {
      const dto = plainToInstance(LinkPreviewQueryDto, { url });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.property).toBe('url');
    }
  });

  it('rejects URLs exceeding the maximum length bound of 2048 characters', async () => {
    const longUrl = `https://example.com/${'a'.repeat(2100)}`;
    const dto = plainToInstance(LinkPreviewQueryDto, { url: longUrl });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('url');
  });
});
