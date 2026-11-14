import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateGroupVocabularyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/, { message: 'term must not be blank' })
  term!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  @Matches(/\S/, { message: 'translation must not be blank' })
  translation!: string;

  @IsString()
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  language!: string;
}
