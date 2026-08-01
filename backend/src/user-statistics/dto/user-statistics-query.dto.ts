import { IsOptional, IsDateString } from 'class-validator';
import 'reflect-metadata';
import { validate } from 'class-validator';

export class UserStatisticsQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

describe('UserStatisticsQueryDto', () => {
  it('should be valid when no properties are provided', async () => {
    const dto = new UserStatisticsQueryDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept valid ISO date strings', async () => {
    const dto = new UserStatisticsQueryDto();
    dto.fromDate = '2024-01-01';
    dto.toDate = '2024-12-31';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid fromDate', async () => {
    const dto = new UserStatisticsQueryDto();
    dto.fromDate = 'not-a-date';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('fromDate');
  });

  it('should reject an invalid toDate', async () => {
    const dto = new UserStatisticsQueryDto();
    dto.toDate = 'foo';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('toDate');
  });

  it('should report errors for both invalid dates', async () => {
    const dto = new UserStatisticsQueryDto();
    dto.fromDate = 'invalid';
    dto.toDate = 'also-invalid';
    const errors = await validate(dto);
    expect(errors).toHaveLength(2);
    const properties = errors.map((err) => err.property).sort();
    expect(properties).toEqual(['fromDate', 'toDate']);
  });
});
