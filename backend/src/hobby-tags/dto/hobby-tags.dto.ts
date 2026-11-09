import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const TRIMMED_TEXT = /^\S(?:.*\S)?$/u;
const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[a-z]{2})?$/iu;

export class ListHobbyTagsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(TRIMMED_TEXT)
  category?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 100;
}

export class CreateHobbyTagDto {
  @IsString()
  @MaxLength(64)
  @Matches(TRIMMED_TEXT)
  name!: string;

  @IsString()
  @MaxLength(64)
  @Matches(TRIMMED_TEXT)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(TRIMMED_TEXT)
  icon?: string;
}

export class AddUserHobbyTagDto {
  @IsUUID('4')
  hobby_tag_id!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  proficiency_level?: number;
}

export class UpdateHobbyProficiencyDto {
  @IsInt()
  @Min(0)
  @Max(3)
  proficiency_level!: number;
}

export class HobbyVocabularyQueryDto {
  @IsString()
  @MaxLength(6)
  @Matches(LANGUAGE_CODE)
  language!: string;
}
