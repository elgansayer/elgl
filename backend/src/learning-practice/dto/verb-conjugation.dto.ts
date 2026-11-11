import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/;

export const VERB_TENSES = ['present', 'past'] as const;
export type VerbTense = (typeof VERB_TENSES)[number];

export class VerbSessionQueryDto {
  @IsOptional()
  @IsString()
  @Length(2, 16)
  @Matches(LANGUAGE_CODE)
  language = 'es';

  @IsOptional()
  @IsIn(VERB_TENSES)
  tense?: VerbTense;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 5;
}

export class SubmitVerbAttemptDto {
  @IsString()
  @Length(4, 200)
  exerciseId!: string;

  @IsString()
  @Length(1, 80)
  answer!: string;
}
