import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class EditTextDto {
  @IsString()
  @MaxLength(4000)
  textContent!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  explanation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  context?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alternativeExpressions?: string[];
}
