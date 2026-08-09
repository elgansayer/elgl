import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LanguagePairQueryDto } from './language-pair-query.dto';

describe('LanguagePairQueryDto', () => {
  const validateDto = async (dto: Record<string, unknown>) => {
    const instance = plainToInstance(LanguagePairQueryDto, dto);
    return validate(instance);
  };

  const buildDto = (overrides: Record<string, unknown> = {}) => {
    return plainToInstance(LanguagePairQueryDto, overrides);
  };

  describe('native_language', () => {
    it('should accept a valid language code', async () => {
      const errors = await validateDto({ native_language: 'EN' });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string value', async () => {
      const errors = await validateDto({ native_language: 123 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('native_language');
    });
  });

  describe('target_language', () => {
    it('should accept a valid language code', async () => {
      const errors = await validateDto({ target_language: 'JA' });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string value', async () => {
      const errors = await validateDto({ target_language: 456 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('target_language');
    });
  });

  describe('page', () => {
    it('should default to 0 when not provided', () => {
      const dto = buildDto({});
      expect(dto.page).toBe(0);
    });

    it('should accept zero-indexed page', async () => {
      const errors = await validateDto({ page: 0 });
      expect(errors).toHaveLength(0);
    });

    it('should parse string page to number', () => {
      const dto = buildDto({ page: '3' });
      expect(dto.page).toBe(3);
    });

    it('should reject negative page', async () => {
      const errors = await validateDto({ page: -1 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
    });
  });

  describe('limit', () => {
    it('should default to 50 when not provided', () => {
      const dto = buildDto({});
      expect(dto.limit).toBe(50);
    });

    it('should accept valid limit', async () => {
      const errors = await validateDto({ limit: 20 });
      expect(errors).toHaveLength(0);
    });

    it('should parse string limit to number', () => {
      const dto = buildDto({ limit: '10' });
      expect(dto.limit).toBe(10);
    });

    it('should reject limit below 1', async () => {
      const errors = await validateDto({ limit: 0 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
    });
  });

  describe('sort', () => {
    it('should default to "best_match" when not provided', () => {
      const dto = buildDto({});
      expect(dto.sort).toBe('best_match');
    });

    it('should accept sort string', async () => {
      const errors = await validateDto({ sort: 'newest' });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string sort', async () => {
      const errors = await validateDto({ sort: 5 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('sort');
    });
  });

  describe('level', () => {
    it('should accept a string proficiency level', async () => {
      const errors = await validateDto({ level: 'A1' });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-string level', async () => {
      const errors = await validateDto({ level: 99 });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('level');
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

  describe('country', () => {
    it('should accept a string country value', async () => {
      const errors = await validateDto({ country: 'Japan' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('city', () => {
    it('should accept a string city value', async () => {
      const errors = await validateDto({ city: 'Osaka' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('learning_goals', () => {
    it('should accept a string value', async () => {
      const errors = await validateDto({ learning_goals: 'conversation' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('learning_goals_mode', () => {
    it('should accept a string value', async () => {
      const errors = await validateDto({ learning_goals_mode: 'any' });
      expect(errors).toHaveLength(0);
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

  describe('full valid DTO', () => {
    it('should accept a complete language pair query', async () => {
      const dto = {
        native_language: 'EN',
        target_language: 'ES',
        page: 1,
        limit: 25,
        sort: 'best_match',
        level: 'B1',
        has_audio_intro: true,
        country: 'Mexico',
        city: 'Mexico City',
        learning_goals: 'fluency',
        learning_goals_mode: 'all',
        availability_morning: true,
        availability_afternoon: false,
        availability_evening: true,
        voice_room_active: false,
      };

      const errors = await validateDto(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept an empty DTO (all fields optional)', async () => {
      const errors = await validateDto({});
      expect(errors).toHaveLength(0);
      const dto = buildDto({});
      expect(dto.page).toBe(0);
      expect(dto.limit).toBe(50);
      expect(dto.sort).toBe('best_match');
    });
  });
});
