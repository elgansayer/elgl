import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { MOMENT_SELECTED_ANSWER_MAX_LENGTH } from '../moments-column-limits.constants';

export class AnswerLanguageQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MOMENT_SELECTED_ANSWER_MAX_LENGTH)
  answer!: string;
}
