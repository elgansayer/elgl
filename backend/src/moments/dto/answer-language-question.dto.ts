import { IsString, IsNotEmpty } from 'class-validator';

export class AnswerLanguageQuestionDto {
  @IsString()
  @IsNotEmpty()
  answer!: string;
}
