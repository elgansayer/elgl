import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

const validateProfile = (payload: Record<string, unknown>) =>
  validate(plainToInstance(UpdateProfileDto, payload));

describe('UpdateProfileDto coordinates', () => {
  it.each([
    ['location', { latitude: -90, longitude: -180 }],
    ['location', { latitude: 90, longitude: 180 }],
    ['mock_location', { latitude: -90, longitude: -180 }],
    ['mock_location', { latitude: 90, longitude: 180 }],
  ])('accepts valid %s boundary coordinates', async (field, coordinates) => {
    await expect(validateProfile({ [field]: coordinates })).resolves.toEqual(
      [],
    );
  });

  it.each([
    ['location', { latitude: 90.0001, longitude: 0 }],
    ['location', { latitude: -90.0001, longitude: 0 }],
    ['location', { latitude: 0, longitude: 180.0001 }],
    ['location', { latitude: 0, longitude: -180.0001 }],
    ['mock_location', { latitude: 90.0001, longitude: 0 }],
    ['mock_location', { latitude: -90.0001, longitude: 0 }],
    ['mock_location', { latitude: 0, longitude: 180.0001 }],
    ['mock_location', { latitude: 0, longitude: -180.0001 }],
  ])('rejects out-of-range %s coordinates', async (field, coordinates) => {
    const errors = await validateProfile({ [field]: coordinates });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe(field);
    expect(errors[0]?.children).toHaveLength(1);
    expect(errors[0]?.children?.[0]?.constraints).toBeDefined();
  });
});
