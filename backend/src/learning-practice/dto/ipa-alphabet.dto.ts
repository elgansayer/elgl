import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/;

export class IpaQueryDto {
  @IsOptional()
  @IsString()
  @Length(2, 16)
  @Matches(LANGUAGE_CODE)
  language = 'en';
}

export class IpaQuizQueryDto extends IpaQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 5;
}

export class SubmitIpaAttemptDto {
  @IsString()
  @Length(3, 200)
  exerciseId!: string;

  @IsString()
  @Length(1, 80)
  answer!: string;
}
