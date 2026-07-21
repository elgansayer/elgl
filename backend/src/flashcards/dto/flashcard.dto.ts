import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateFlashcardDto {
  @IsString()
  @IsNotEmpty()
  word_token!: string;

  @IsOptional()
  @IsString()
  original_context?: string;

  @IsString()
  @IsNotEmpty()
  translation!: string;

  @IsOptional()
  @IsString()
  definition?: string;

  @IsOptional()
  @IsString()
  pronunciation_url?: string;
}

export class UpdateSrsDto {
  @IsInt()
  @Min(0)
  @Max(4)
  srs_level!: number;
}
