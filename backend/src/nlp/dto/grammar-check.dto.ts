import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class GrammarCheckDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(35)
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, {
    message: 'language must be a valid BCP 47-style language tag',
  })
  language?: string;
}
