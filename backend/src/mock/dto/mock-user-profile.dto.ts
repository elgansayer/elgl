import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MOCK_PROFICIENCY_LEVELS = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
] as const;

export class MockUserProfileDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  display_name?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  native_languages!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  target_languages!: string[];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio_text?: string;

  @ApiProperty()
  @IsString()
  nationality!: string;

  @ApiProperty()
  @IsString()
  region!: string;

  @ApiProperty({ example: 'Asia/Tokyo' })
  @IsString()
  timezone!: string;

  @ApiProperty({ minimum: 18, maximum: 100 })
  @IsInt()
  @Min(18)
  @Max(100)
  age!: number;

  @ApiProperty()
  @IsString()
  gender!: string;

  @ApiProperty({ enum: MOCK_PROFICIENCY_LEVELS })
  @IsIn(MOCK_PROFICIENCY_LEVELS)
  proficiency_level!: (typeof MOCK_PROFICIENCY_LEVELS)[number];

  @ApiProperty()
  @IsBoolean()
  is_vip!: boolean;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  study_streak_days!: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  correction_ratio!: number;

  @ApiProperty()
  @IsBoolean()
  is_serious_learner!: boolean;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601()
  created_at!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  last_active_at?: string;
}

export class UpdateMockUserProfileDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  display_name?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio_text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_serious_learner?: boolean;

  @ApiPropertyOptional({ enum: MOCK_PROFICIENCY_LEVELS })
  @IsOptional()
  @IsIn(MOCK_PROFICIENCY_LEVELS)
  proficiency_level?: (typeof MOCK_PROFICIENCY_LEVELS)[number];
}
