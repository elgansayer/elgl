import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TransliterateDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsString()
  @IsNotEmpty()
  source_language!: string;

  @IsString()
  @IsNotEmpty()
  target_script!: string;

  @IsOptional()
  @IsString()
  from_script?: string;
}