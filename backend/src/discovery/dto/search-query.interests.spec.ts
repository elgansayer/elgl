import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { SearchQueryDto } from './search-query.dto';

async function validateInterest(value: unknown) {
  const dto = plainToInstance(SearchQueryDto, { interests: value });
  return { dto, errors: await validate(dto) };
}

describe('SearchQueryDto interest filter', () => {
  it('normalizes a single interest tag before discovery filtering', async () => {
    const { dto, errors } = await validateInterest('  Photography  ');

    expect(errors).toHaveLength(0);
    expect(dto.interests).toBe('photography');
  });

  it('normalizes compatibility-equivalent unicode text', async () => {
    const { dto, errors } = await validateInterest('Ｔｅｃｈｎｏｌｏｇｙ');

    expect(errors).toHaveLength(0);
    expect(dto.interests).toBe('technology');
  });

  it('rejects comma-separated values instead of silently changing match semantics', async () => {
    const { errors } = await validateInterest('sports,music');

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('interests');
  });

  it('rejects overlong interest values', async () => {
    const { errors } = await validateInterest('a'.repeat(51));

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('interests');
  });

  it('rejects control characters', async () => {
    const { errors } = await validateInterest('music\nadmin=true');

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('interests');
  });

  it('keeps the filter optional', async () => {
    const { dto, errors } = await validateInterest(undefined);

    expect(errors).toHaveLength(0);
    expect(dto.interests).toBeUndefined();
  });
});
