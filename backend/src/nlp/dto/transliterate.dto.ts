import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class TransliterateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  language!: string;

  @IsString()
  @Matches(/^[A-Za-z]{4}$/)
  from_script!: string;

  @IsString()
  @Matches(/^[A-Za-z]{4}$/)
  to_script!: string;
}
