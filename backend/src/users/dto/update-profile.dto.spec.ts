import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';
import { PROFICIENCY_LEVELS } from '../proficiency-level';

describe('UpdateProfileDto', () => {
  it('should be defined', () => {
    const dto = new UpdateProfileDto();
    expect(dto).toBeDefined();
  });

  it.each(PROFICIENCY_LEVELS)(
    'accepts the supported CEFR proficiency level %s',
    async (proficiencyLevel) => {
      const dto = Object.assign(new UpdateProfileDto(), {
        proficiency_level: proficiencyLevel,
      });

      const errors = await validate(dto);

      expect(
        errors.filter((error) => error.property === 'proficiency_level'),
      ).toHaveLength(0);
    },
  );

  it.each(['a1', 'B3', 'native', ''])(
    'rejects an unsupported proficiency level %s',
    async (proficiencyLevel) => {
      const dto = Object.assign(new UpdateProfileDto(), {
        proficiency_level: proficiencyLevel,
      });

      const errors = await validate(dto);

      expect(
        errors.some((error) => error.property === 'proficiency_level'),
      ).toBe(true);
    },
  );

  it('keeps proficiency level optional for unrelated profile updates', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      display_name: 'Learner',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'proficiency_level')).toBe(
      false,
    );
  });

  it('accepts null to clear a saved proficiency level', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      proficiency_level: null,
    });

    const errors = await validate(dto);

    expect(
      errors.filter((error) => error.property === 'proficiency_level'),
    ).toHaveLength(0);
  });

  it('accepts the five-language transport ceiling used by Pro and Developer tiers', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      target_languages: ['ja', 'fr', 'es', 'de', 'it'],
    });

    const errors = await validate(dto);

    expect(
      errors.filter((error) => error.property === 'target_languages'),
    ).toHaveLength(0);
  });

  it('rejects more than five target languages before entitlement checks', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      target_languages: ['ja', 'fr', 'es', 'de', 'it', 'pt'],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'target_languages')).toBe(
      true,
    );
  });
  describe('self-declared age', () => {
    it.each([13, 30, 120])('accepts %i', async (age) => {
      const errors = await validate(
        Object.assign(new UpdateProfileDto(), { age }),
      );

      expect(errors.filter((error) => error.property === 'age')).toHaveLength(
        0,
      );
    });

    it.each([0, 1, 12, -5, 121, 150, 12.5])(
      'rejects %s so a declared child age is never accepted',
      async (age) => {
        const errors = await validate(
          Object.assign(new UpdateProfileDto(), { age }),
        );

        expect(errors.some((error) => error.property === 'age')).toBe(true);
      },
    );
  });
});
