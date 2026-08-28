import { IsString } from 'class-validator';

export class ExplainGrammarDto {
  @IsString()
  original!: string;

  @IsString()
  corrected!: string;
}
