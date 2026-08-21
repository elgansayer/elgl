import { IsString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ProficiencyLevel } from '../interfaces/proficiency.interface';

export class TargetLanguageDto {
  @IsString()
  language!: string;

  @IsEnum(ProficiencyLevel)
  level!: ProficiencyLevel;
}

export class LanguageSelectionDto {
  @IsString()
  userId!: string;

  @IsString()
  nativeLanguage!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TargetLanguageDto)
  targetLanguages!: TargetLanguageDto[];
}
