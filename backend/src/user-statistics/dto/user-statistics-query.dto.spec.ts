import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { UserStatisticsQueryDto } from './user-statistics-query.dto';

describe('UserStatisticsQueryDto', () => {
  it('should be valid when no properties are provided', () => {
    const dto = new UserStatisticsQueryDto();
    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid ISO date strings', () => {
    const dto = new UserStatisticsQueryDto();
    dto.fromDate = '2024-01-01';
    dto.toDate = '2024-12-31';
    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid fromDate', () => {
    const dto = new UserStatisticsQueryDto();
    dto.fromDate = 'not-a-date';
    const errors = validateSync(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('fromDate');
  });

  it('should reject an invalid toDate', () => {
    const dto = new UserStatisticsQueryDto();
    dto.toDate = 'foo';
    const errors = validateSync(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('toDate');
  });

  it('should report errors for both invalid dates', () => {
    const dto = new UserStatisticsQueryDto();
    dto.fromDate = 'invalid';
    dto.toDate = 'also-invalid';
    const errors = validateSync(dto);
    expect(errors).toHaveLength(2);
    const properties = errors.map((err) => err.property).sort();
    expect(properties).toEqual(['fromDate', 'toDate']);
  });
});
