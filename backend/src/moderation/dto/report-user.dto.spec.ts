import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReportUserDto } from './report-user.dto';
import { SAFETY_REPORT_DESCRIPTION_MAX_LENGTH } from '../../safety/safety.constants';

const TARGET = '22222222-2222-4222-8222-222222222222';

const toDto = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(ReportUserDto, {
    reportedUserId: TARGET,
    reasonCategory: 'harassment',
    ...overrides,
  });

describe('ReportUserDto', () => {
  describe('validation', () => {
    it('should accept a valid DTO', async () => {
      expect(await validate(toDto())).toHaveLength(0);
    });

    it('should accept an optional description', async () => {
      const dto = toDto({
        reasonCategory: 'spam',
        description: 'Has posted spam repeatedly.',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('should reject missing reportedUserId', async () => {
      const dto = plainToInstance(ReportUserDto, {
        reasonCategory: 'harassment',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reportedUserId')).toBe(true);
    });

    it.each(['', 'user-123', 'not-a-uuid'])(
      'should reject the non-UUID reportedUserId %p',
      async (reportedUserId) => {
        const errors = await validate(toDto({ reportedUserId }));
        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('reportedUserId');
      },
    );

    it('should reject missing reasonCategory', async () => {
      const dto = plainToInstance(ReportUserDto, { reportedUserId: TARGET });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reasonCategory')).toBe(true);
    });

    it.each(['', 'made-up', 'admin_warning', 'SPAM'])(
      'should reject the unknown reasonCategory %p so metric labels stay bounded',
      async (reasonCategory) => {
        const errors = await validate(toDto({ reasonCategory }));
        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('reasonCategory');
      },
    );

    it.each([
      'harassment',
      'spam',
      'inappropriate_content',
      'fake_profile',
      'other',
    ])('should accept the %s reasonCategory', async (reasonCategory) => {
      expect(await validate(toDto({ reasonCategory }))).toHaveLength(0);
    });

    it('should trim the description and treat blank as absent', async () => {
      expect(toDto({ description: '  spammy  ' }).description).toBe('spammy');
      const blank = toDto({ description: '   ' });
      expect(blank.description).toBeUndefined();
      expect(await validate(blank)).toHaveLength(0);
    });

    it('should reject a description over the shared limit', async () => {
      const errors = await validate(
        toDto({
          description: 'a'.repeat(SAFETY_REPORT_DESCRIPTION_MAX_LENGTH + 1),
        }),
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
    });

    it('should reject a non-string description', async () => {
      const errors = await validate(toDto({ description: 123 }));
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
    });
  });
});
