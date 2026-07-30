import {
  IsString,
  IsArray,
  ArrayNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreatePollDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  question!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options!: string[];
}
