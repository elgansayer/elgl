import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  IsIn,
} from 'class-validator';

export class CreateChallengeDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsInt()
  @Min(1)
  entryFeeCoins!: number;

  @IsInt()
  @Min(1)
  durationDays!: number;

  @IsOptional()
  @IsString()
  @IsIn(['streak', 'points'])
  challengeType?: 'streak' | 'points';
}
