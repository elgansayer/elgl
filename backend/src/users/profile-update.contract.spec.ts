import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

describe('profile update contract', () => {
  it('accepts the core profile and privacy fields together', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      bio_text: 'I am learning Japanese for travel.',
      native_languages: ['en'],
      target_languages: ['ja', 'es', 'fr'],
      privacy_hide_age: true,
      privacy_hide_location: true,
      privacy_hide_from_search: false,
      privacy_hide_gender: true,
      privacy_hide_exact_location: true,
      privacy_hide_online_status: true,
      privacy_hide_vip_status: true,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects more than five target languages at the API validation boundary', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      target_languages: ['ja', 'es', 'fr', 'de', 'it', 'pt'],
    });

    const errors = await validate(dto);

    expect(
      errors.some(
        (error) =>
          error.property === 'target_languages' &&
          Boolean(error.constraints?.arrayMaxSize),
      ),
    ).toBe(true);
  });

  it('rejects non-boolean privacy toggles instead of coercing untrusted input', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      privacy_hide_age: 'true',
    });

    const errors = await validate(dto);

    expect(
      errors.some(
        (error) =>
          error.property === 'privacy_hide_age' &&
          Boolean(error.constraints?.isBoolean),
      ),
    ).toBe(true);
  });

  it('enforces the one-target-language free-tier limit in the service', async () => {
    const service = Object.create(UsersService.prototype) as UsersService;

    await expect(
      service.updateProfile(
        'free-user',
        { target_languages: ['ja', 'es'] },
        false,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the service-side Consumer VIP ceiling at three target languages', async () => {
    const service = Object.create(UsersService.prototype) as UsersService;
    vi.spyOn(service, 'getProfile').mockResolvedValue({
      id: 'vip-user',
      is_vip: true,
      vip_tier: 'consumer',
    } as never);

    await expect(
      service.updateProfile(
        'vip-user',
        { target_languages: ['ja', 'es', 'fr', 'de'] },
        true,
      ),
    ).rejects.toThrow(
      'A maximum of 3 target languages can be studied simultaneously on your current tier.',
    );
  });
});
