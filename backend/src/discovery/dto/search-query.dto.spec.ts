import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchQueryDto } from './search-query.dto';

describe('SearchQueryDto', () => {
  const validateDto = async (dto: Record<string, unknown>) => {
    const instance = plainToInstance(SearchQueryDto, dto);
    return validate(instance);
  };

  const buildDto = (overrides: Record<string, unknown> = {}) => {
    const instance = plainToInstance(SearchQueryDto, overrides);
    return instance;
  };

  describe('latitude', () => {
    it('should accept valid latitude with longitude', async () => {
      const errors = await validateDto({ latitude: 51.5074, longitude: -0.1278 });
      expect(errors).toHaveLength(0);
    });

    it('should parse string latitude to number', () => {
      const dto = buildDto({ latitude: '51.5074' });
      expect(dto.latitude).toBe(51.5074);
    });

    it('should reject latitude below -90', async () => {
      const errors = await validateDto({ latitude: -91, longitude: 0 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('latitude');
    });

    it('should reject latitude above 90', async () => {
      const errors = await validateDto({ latitude: 91, longitude: 0 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('latitude');
    });
  });

  describe('longitude', () => {
    it('should accept valid longitude with latitude', async () => {
      const errors = await validateDto({ latitude: 51.5074, longitude: -0.1278 });
      expect(errors).toHaveLength(0);
    });

    it('should parse string longitude to number', () => {
      const dto = buildDto({ longitude: '-0.1278' });
      expect(dto.longitude).toBe(-0.1278);
    });

    it('should reject longitude below -180', async () => {
      const errors = await validateDto({ latitude: 0, longitude: -181 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('longitude');
    });

    it('should reject longitude above 180', async () => {
      const errors = await validateDto({ latitude: 0, longitude: 181 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('longitude');
    });
  });

  describe('radius_metres', () => {
    it('should default to 50000 when not provided', () => {
      const dto = buildDto({});
      expect(dto.radius_metres).toBe(50000);
    });

    it('should accept valid radius', async () => {
      const errors = await validateDto({ radius_metres: 10000 });
      expect(errors).toHaveLength(0);
    });

    it('should parse string radius to number', () => {
      const dto = buildDto({ radius_metres: '10000' });
      expect(dto.radius_metres).toBe(10000);
    });

    it('should reject radius below 1000', async () => {
      const errors = await validateDto({ radius_metres: 999 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('radius_metres');
    });

    it('should reject radius above 250000', async () => {
      const errors = await validateDto({ radius_metres: 250001 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('radius_metres');
    });
  });

  describe('native_languages', () => {
    it('should accept a valid language code string', async () => {
      const errors = await validateDto({ native_languages: 'ES' });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string value', async () => {
      const errors = await validateDto({ native_languages: 123 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('native_languages');
    });
  });

  describe('target_language', () => {
    it('should accept a valid language code string', async () => {
      const errors = await validateDto({ target_language: 'EN' });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string value', async () => {
      const errors = await validateDto({ target_language: 456 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('target_language');
    });
  });

  describe('serious_learner_only', () => {
    it('should transform "true" string to boolean true', () => {
      const dto = buildDto({ serious_learner_only: 'true' });
      expect(dto.serious_learner_only).toBe(true);
    });

    it('should accept boolean true', async () => {
      const errors = await validateDto({ serious_learner_only: true });
      expect(errors).toHaveLength(0);
    });

    it('should accept boolean false', async () => {
      const errors = await validateDto({ serious_learner_only: false });
      expect(errors).toHaveLength(0);
    });

    it('should transform non-"true" string to boolean false', () => {
      const dto = buildDto({ serious_learner_only: 'yes' });
      expect(dto.serious_learner_only).toBe(false);
    });
  });

  describe('level', () => {
    it('should accept a string proficiency level', async () => {
      const errors = await validateDto({ level: 'B2' });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string level', async () => {
      const errors = await validateDto({ level: 42 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('level');
    });
  });

  describe('gender', () => {
    it('should accept a string gender value', async () => {
      const errors = await validateDto({ gender: 'female' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('interests', () => {
    it('should accept a string interests value', async () => {
      const errors = await validateDto({ interests: 'music' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('age_min', () => {
    it('should accept valid age', async () => {
      const errors = await validateDto({ age_min: 18 });
      expect(errors).toHaveLength(0);
    });

    it('should parse string age to number', () => {
      const dto = buildDto({ age_min: '25' });
      expect(dto.age_min).toBe(25);
    });

    it('should reject age below 1', async () => {
      const errors = await validateDto({ age_min: 0 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('age_min');
    });

    it('should reject age above 120', async () => {
      const errors = await validateDto({ age_min: 121 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('age_min');
    });
  });

  describe('age_max', () => {
    it('should accept valid age', async () => {
      const errors = await validateDto({ age_max: 65 });
      expect(errors).toHaveLength(0);
    });

    it('should parse string age to number', () => {
      const dto = buildDto({ age_max: '65' });
      expect(dto.age_max).toBe(65);
    });

    it('should reject age below 1', async () => {
      const errors = await validateDto({ age_max: 0 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('age_max');
    });

    it('should reject age above 120', async () => {
      const errors = await validateDto({ age_max: 121 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('age_max');
    });
  });

  describe('voice_room_active', () => {
    it('should transform "true" string to boolean true', () => {
      const dto = buildDto({ voice_room_active: 'true' });
      expect(dto.voice_room_active).toBe(true);
    });

    it('should accept boolean true', async () => {
      const errors = await validateDto({ voice_room_active: true });
      expect(errors).toHaveLength(0);
    });
  });

  describe('has_audio_intro', () => {
    it('should transform "true" string to boolean true', () => {
      const dto = buildDto({ has_audio_intro: 'true' });
      expect(dto.has_audio_intro).toBe(true);
    });

    it('should accept boolean true', async () => {
      const errors = await validateDto({ has_audio_intro: true });
      expect(errors).toHaveLength(0);
    });
  });

  describe('serious_learner_mode', () => {
    it('should transform "true" string to boolean true', () => {
      const dto = buildDto({ serious_learner_mode: 'true' });
      expect(dto.serious_learner_mode).toBe(true);
    });

    it('should accept boolean true', async () => {
      const errors = await validateDto({ serious_learner_mode: true });
      expect(errors).toHaveLength(0);
    });
  });

  describe('country', () => {
    it('should accept a string country value', async () => {
      const errors = await validateDto({ country: 'Japan' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('city', () => {
    it('should accept a string city value', async () => {
      const errors = await validateDto({ city: 'Tokyo' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('sort', () => {
    it('should accept sort string', async () => {
      const errors = await validateDto({ sort: 'nearest' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('available_time validation', () => {
    it('should accept valid HH:mm format', async () => {
      const errors = await validateDto({
        available_time_start: '08:00',
        available_time_end: '18:00',
      });
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid available_time_start format', async () => {
      const errors = await validateDto({ available_time_start: '8:00' });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('available_time_start');
    });

    it('should reject invalid available_time_end format', async () => {
      const errors = await validateDto({ available_time_end: 'abc' });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('available_time_end');
    });

    it('should reject non-string available_time_start', async () => {
      const errors = await validateDto({ available_time_start: 800 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('available_time_start');
    });
  });

  describe('availability booleans', () => {
    it.each([
      'availability_morning',
      'availability_afternoon',
      'availability_evening',
    ])('should transform "%s" string to boolean', (field) => {
      const dto = buildDto({ [field]: 'true' });
      expect((dto as Record<string, unknown>)[field]).toBe(true);
    });
  });

  describe('full valid DTO', () => {
    it('should accept a well-formed matchmaking query', async () => {
      const dto = {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 10000,
        native_languages: 'ES',
        target_language: 'EN',
        serious_learner_only: true,
        level: 'B2',
        gender: 'any',
        interests: 'music',
        age_min: 18,
        age_max: 65,
        voice_room_active: false,
        has_audio_intro: true,
        serious_learner_mode: false,
        country: 'Spain',
        city: 'Barcelona',
        sort: 'best_match',
        availability_morning: true,
        available_time_start: '08:00',
        available_time_end: '18:00',
      };

      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept an empty DTO (all fields optional)', async () => {
      const errors = await validateDto({});
      expect(errors).toHaveLength(0);
      const dto = buildDto({});
      expect(dto.radius_metres).toBe(50000);
    });
  });

  describe('learning_goals', () => {
    it('should accept a string learning_goals value', async () => {
      const errors = await validateDto({ learning_goals: 'fluency' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('learning_goals_mode', () => {
    it('should accept a string learning_goals_mode value', async () => {
      const errors = await validateDto({ learning_goals_mode: 'any' });
      expect(errors).toHaveLength(0);
    });
  });
});
