import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateChallengeDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  entryFeeCoins!: number;

  @IsInt()
  @Min(1)
  @Max(30)
  durationDays!: number;

  @IsOptional()
  @IsString()
  @IsIn(['streak', 'points'])
  challengeType?: 'streak' | 'points';
}
