import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchQueryDto } from './search-query.dto';

async function errorsFor(input: Record<string, unknown>) {
  return validate(plainToInstance(SearchQueryDto, input));
}

describe('SearchQueryDto nearby location contract', () => {
  it('allows searches without a location pair', async () => {
    await expect(errorsFor({ radius_metres: '50000' })).resolves.toHaveLength(0);
  });

  it('accepts a complete latitude and longitude pair', async () => {
    const dto = plainToInstance(SearchQueryDto, {
      latitude: '54.047',
      longitude: '-2.801',
      radius_metres: '10000',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.latitude).toBe(54.047);
    expect(dto.longitude).toBe(-2.801);
    expect(dto.radius_metres).toBe(10000);
  });

  it.each([
    [{ latitude: '54.047' }, 'longitude'],
    [{ longitude: '-2.801' }, 'latitude'],
  ])('rejects an incomplete coordinate pair %#', async (input, missingField) => {
    const errors = await errorsFor(input);
    expect(errors.some((error) => error.property === missingField)).toBe(true);
  });

  it('rejects coordinates outside geographic bounds', async () => {
    const errors = await errorsFor({ latitude: '91', longitude: '181' });
    expect(errors.some((error) => error.property === 'latitude')).toBe(true);
    expect(errors.some((error) => error.property === 'longitude')).toBe(true);
  });

  it('caps the public nearby radius at 250 kilometres', async () => {
    await expect(errorsFor({ radius_metres: '250000' })).resolves.toHaveLength(0);

    const errors = await errorsFor({ radius_metres: '250001' });
    expect(errors.some((error) => error.property === 'radius_metres')).toBe(true);
  });
});
