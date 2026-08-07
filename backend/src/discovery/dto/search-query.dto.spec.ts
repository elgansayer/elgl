import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SearchQueryDto } from './search-query.dto';

function makeDto(plain: Record<string, unknown>): SearchQueryDto {
  return plainToInstance(SearchQueryDto, plain);
}

describe('SearchQueryDto', () => {
  it('should accept an empty DTO (all fields optional)', async () => {
    const dto = makeDto({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // -- latitude ----------------------------------------------------------------
  describe('latitude', () => {
    it('should transform valid latitude from string', async () => {
      const dto = makeDto({ latitude: '51.5074' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.latitude).toBe(51.5074);
    });

    it('should accept a valid latitude number', async () => {
      const dto = makeDto({ latitude: 48.8566 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject latitude below -90', async () => {
      const dto = makeDto({ latitude: -91 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitude')).toBe(true);
    });

    it('should reject latitude above 90', async () => {
      const dto = makeDto({ latitude: 91 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitude')).toBe(true);
    });
  });

  // -- longitude ---------------------------------------------------------------
  describe('longitude', () => {
    it('should transform valid longitude from string', async () => {
      const dto = makeDto({ longitude: '-0.1278' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.longitude).toBe(-0.1278);
    });

    it('should reject longitude below -180', async () => {
      const dto = makeDto({ longitude: -181 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'longitude')).toBe(true);
    });

    it('should reject longitude above 180', async () => {
      const dto = makeDto({ longitude: 181 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'longitude')).toBe(true);
    });
  });

  // -- radius_metres -----------------------------------------------------------
  describe('radius_metres', () => {
    it('should default to 50000', async () => {
      const dto = makeDto({});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.radius_metres).toBe(50000);
    });

    it('should transform valid value from string', async () => {
      const dto = makeDto({ radius_metres: '10000' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.radius_metres).toBe(10000);
    });

    it('should reject radius below 1000', async () => {
      const dto = makeDto({ radius_metres: 500 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'radius_metres')).toBe(true);
    });

    it('should reject radius above 20,000,000', async () => {
      const dto = makeDto({ radius_metres: 30000000 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'radius_metres')).toBe(true);
    });
  });

  // -- native_languages --------------------------------------------------------
  describe('native_languages', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ native_languages: 'JA' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- target_language ---------------------------------------------------------
  describe('target_language', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ target_language: 'EN' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- serious_learner_only ----------------------------------------------------
  describe('serious_learner_only', () => {
    it('should transform "true" string to boolean true', async () => {
      const dto = makeDto({ serious_learner_only: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.serious_learner_only).toBe(true);
    });

    it('should not transform arbitrary string to true', async () => {
      const dto = makeDto({ serious_learner_only: 'false' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.serious_learner_only).toBe(false);
    });
  });

  // -- level -------------------------------------------------------------------
  describe('level', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ level: 'B2' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- gender ------------------------------------------------------------------
  describe('gender', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ gender: 'female' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- interests ---------------------------------------------------------------
  describe('interests', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ interests: 'music' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- age_min -----------------------------------------------------------------
  describe('age_min', () => {
    it('should transform valid number from string', async () => {
      const dto = makeDto({ age_min: '20' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.age_min).toBe(20);
    });

    it('should reject value below 1', async () => {
      const dto = makeDto({ age_min: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'age_min')).toBe(true);
    });

    it('should reject value above 120', async () => {
      const dto = makeDto({ age_min: 121 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'age_min')).toBe(true);
    });
  });

  // -- age_max -----------------------------------------------------------------
  describe('age_max', () => {
    it('should transform valid number from string', async () => {
      const dto = makeDto({ age_max: '30' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.age_max).toBe(30);
    });

    it('should reject value above 120', async () => {
      const dto = makeDto({ age_max: 121 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'age_max')).toBe(true);
    });
  });

  // -- voice_room_active -------------------------------------------------------
  describe('voice_room_active', () => {
    it('should transform "true" string to boolean true', async () => {
      const dto = makeDto({ voice_room_active: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.voice_room_active).toBe(true);
    });
  });

  // -- sort --------------------------------------------------------------------
  describe('sort', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ sort: 'newest' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- has_audio_intro ---------------------------------------------------------
  describe('has_audio_intro', () => {
    it('should transform "true" string to boolean true', async () => {
      const dto = makeDto({ has_audio_intro: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.has_audio_intro).toBe(true);
    });
  });

  // -- country / city ----------------------------------------------------------
  describe('country and city', () => {
    it('should accept country as string', async () => {
      const dto = makeDto({ country: 'Japan' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept city as string', async () => {
      const dto = makeDto({ city: 'Tokyo' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- serious_learner_mode ----------------------------------------------------
  describe('serious_learner_mode', () => {
    it('should transform "true" string to boolean true', async () => {
      const dto = makeDto({ serious_learner_mode: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.serious_learner_mode).toBe(true);
    });
  });

  // -- learning_goals ----------------------------------------------------------
  describe('learning_goals', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ learning_goals: 'grammar,vocabulary' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- learning_goals_mode -----------------------------------------------------
  describe('learning_goals_mode', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ learning_goals_mode: 'and' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- availability fields -----------------------------------------------------
  describe('availability fields', () => {
    it('should transform availability_morning string to boolean', async () => {
      const dto = makeDto({ availability_morning: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.availability_morning).toBe(true);
    });

    it('should transform availability_afternoon string to boolean', async () => {
      const dto = makeDto({ availability_afternoon: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.availability_afternoon).toBe(true);
    });

    it('should transform availability_evening string to boolean', async () => {
      const dto = makeDto({ availability_evening: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.availability_evening).toBe(true);
    });
  });

  // -- available_time_start / available_time_end -------------------------------
  describe('available_time fields', () => {
    it('should accept valid HH:mm time strings', async () => {
      const dto = makeDto({
        available_time_start: '09:00',
        available_time_end: '17:00',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid time format for available_time_start', async () => {
      const dto = makeDto({ available_time_start: '9:00' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'available_time_start')).toBe(
        true,
      );
    });

    it('should reject invalid time format for available_time_end', async () => {
      const dto = makeDto({ available_time_end: '1700' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'available_time_end')).toBe(true);
    });
  });
});