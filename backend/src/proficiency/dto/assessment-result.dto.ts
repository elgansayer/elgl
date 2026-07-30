import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class AssessmentResultDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  grammarScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vocabularyScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  pronunciationScore?: number;
}
