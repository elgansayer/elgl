import { IsString, Matches, MaxLength } from 'class-validator';

const MAX_GRAMMAR_SENTENCE_LENGTH = 4_000;

export class ExplainGrammarDto {
  @IsString()
  @MaxLength(MAX_GRAMMAR_SENTENCE_LENGTH)
  @Matches(/\S/, { message: 'original must contain non-whitespace text' })
  original!: string;

  @IsString()
  @MaxLength(MAX_GRAMMAR_SENTENCE_LENGTH)
  @Matches(/\S/, { message: 'corrected must contain non-whitespace text' })
  corrected!: string;
}
