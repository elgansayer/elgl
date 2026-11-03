import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import {
  MOMENT_CORRECT_ANSWER_MAX_LENGTH,
  MOMENT_TARGET_LANGUAGE_MAX_LENGTH,
} from '../moments-column-limits.constants';

export class CreateLanguageQuestionDto {
  @IsOptional()
  @IsString()
  text_content?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MOMENT_TARGET_LANGUAGE_MAX_LENGTH)
  target_language!: string;

  @IsString()
  @IsNotEmpty()
  question_text!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  question_options!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(MOMENT_CORRECT_ANSWER_MAX_LENGTH)
  correct_answer!: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
}
