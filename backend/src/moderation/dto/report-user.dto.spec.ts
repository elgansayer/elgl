import { validate } from 'class-validator';
import { ReportUserDto } from './report-user.dto';

describe('ReportUserDto', () => {
  describe('validation', () => {
    it('should accept a valid DTO', async () => {
      const dto = new ReportUserDto();
      dto.reportedUserId = 'user-123';
      dto.reasonCategory = 'harassment';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept an optional description', async () => {
      const dto = new ReportUserDto();
      dto.reportedUserId = 'user-123';
      dto.reasonCategory = 'spam';
      dto.description = 'Has posted spam repeatedly.';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject missing reportedUserId', async () => {
      const dto = new ReportUserDto();
      dto.reasonCategory = 'harassment';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reportedUserId')).toBe(true);
    });

    it('should reject empty reportedUserId', async () => {
      const dto = new ReportUserDto();
      dto.reportedUserId = '';
      dto.reasonCategory = 'harassment';
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('reportedUserId');
    });

    it('should reject missing reasonCategory', async () => {
      const dto = new ReportUserDto();
      dto.reportedUserId = 'user-123';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reasonCategory')).toBe(true);
    });

    it('should reject empty reasonCategory', async () => {
      const dto = new ReportUserDto();
      dto.reportedUserId = 'user-123';
      dto.reasonCategory = '';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reasonCategory')).toBe(true);
    });

    it('should reject non-string reportedUserId', async () => {
      const dto = new ReportUserDto();
      (dto as any).reportedUserId = 123;
      dto.reasonCategory = 'harassment';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reportedUserId')).toBe(true);
    });

    it('should reject non-string reasonCategory', async () => {
      const dto = new ReportUserDto();
      dto.reportedUserId = 'user-123';
      (dto as any).reasonCategory = 123;
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reasonCategory')).toBe(true);
    });

    it('should reject non-string description', async () => {
      const dto = new ReportUserDto();
      dto.reportedUserId = 'user-123';
      dto.reasonCategory = 'spam';
      (dto as any).description = 42;
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });
  });
});
