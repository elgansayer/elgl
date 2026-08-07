import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LanguagePairQueryDto } from './language-pair-query.dto';

function makeDto(plain: Record<string, unknown>): LanguagePairQueryDto {
  return plainToInstance(LanguagePairQueryDto, plain);
}

describe('LanguagePairQueryDto', () => {
  it('should accept an empty DTO (all fields optional)', async () => {
    const dto = makeDto({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // -- native_language ---------------------------------------------------------
  describe('native_language', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ native_language: 'EN' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- target_language ---------------------------------------------------------
  describe('target_language', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ target_language: 'JA' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- page --------------------------------------------------------------------
  describe('page', () => {
    it('should default to 0', async () => {
      const dto = makeDto({});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(0);
    });

    it('should accept a valid page number', async () => {
      const dto = makeDto({ page: 2 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject negative page', async () => {
      const dto = makeDto({ page: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });
  });

  // -- limit -------------------------------------------------------------------
  describe('limit', () => {
    it('should default to 50', async () => {
      const dto = makeDto({});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(50);
    });

    it('should accept a valid limit', async () => {
      const dto = makeDto({ limit: 20 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject limit below 1', async () => {
      const dto = makeDto({ limit: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });

  // -- sort --------------------------------------------------------------------
  describe('sort', () => {
    it('should default to "best_match"', async () => {
      const dto = makeDto({});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.sort).toBe('best_match');
    });

    it('should accept a custom sort value', async () => {
      const dto = makeDto({ sort: 'newest' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
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

  // -- has_audio_intro ---------------------------------------------------------
  describe('has_audio_intro', () => {
    it('should transform "true" string to boolean true', async () => {
      const dto = makeDto({ has_audio_intro: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.has_audio_intro).toBe(true);
    });

    it('should not transform non-"true" string to true', async () => {
      const dto = makeDto({ has_audio_intro: 'false' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.has_audio_intro).toBe(false);
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

  // -- learning_goals ----------------------------------------------------------
  describe('learning_goals', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ learning_goals: 'grammar,pronunciation' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  // -- learning_goals_mode -----------------------------------------------------
  describe('learning_goals_mode', () => {
    it('should accept a string value', async () => {
      const dto = makeDto({ learning_goals_mode: 'or' });
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

  // -- voice_room_active -------------------------------------------------------
  describe('voice_room_active', () => {
    it('should transform "true" string to boolean true', async () => {
      const dto = makeDto({ voice_room_active: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.voice_room_active).toBe(true);
    });

    it('should transform non-"true" string to boolean false', async () => {
      const dto = makeDto({ voice_room_active: 'false' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.voice_room_active).toBe(false);
    });
  });
});