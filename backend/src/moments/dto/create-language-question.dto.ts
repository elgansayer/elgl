import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class CreateLanguageQuestionDto {
  @IsOptional()
  @IsString()
  text_content?: string;

  @IsString()
  @IsNotEmpty()
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
  correct_answer!: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
}
