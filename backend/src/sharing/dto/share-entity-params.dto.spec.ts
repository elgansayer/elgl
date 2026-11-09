import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { ShareEntityParamsDto } from './share-entity-params.dto';

describe('ShareEntityParamsDto', () => {
  it('accepts every supported entity type and a safe id', async () => {
    for (const entityType of ['tutor', 'group', 'room', 'moment', 'event']) {
      const dto = plainToInstance(ShareEntityParamsDto, {
        entityType,
        entityId: '9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f',
      });
      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it('rejects unknown entity types', async () => {
    const dto = plainToInstance(ShareEntityParamsDto, {
      entityType: 'user',
      entityId: 'abc',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'entityType')).toBe(true);
  });

  it('rejects ids with unsupported characters or excessive length', async () => {
    const invalid = ['../etc/passwd', 'abc def', 'a'.repeat(129)];
    for (const entityId of invalid) {
      const dto = plainToInstance(ShareEntityParamsDto, {
        entityType: 'event',
        entityId,
      });
      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'entityId')).toBe(true);
    }
  });
});
