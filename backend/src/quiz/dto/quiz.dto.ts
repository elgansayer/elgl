import { IsObject, IsString, Length, Matches } from 'class-validator';

const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/;

export class QuizQuestionsQueryDto {
  @IsString()
  @Length(2, 16)
  @Matches(LANGUAGE_CODE)
  language = 'en';
}

export class SubmitQuizDto {
  @IsString()
  @Length(2, 16)
  @Matches(LANGUAGE_CODE)
  targetLanguage!: string;

  @IsObject()
  answers!: Record<string, string>;
}
