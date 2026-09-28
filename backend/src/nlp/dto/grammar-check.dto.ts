import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GrammarCheckDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  language?: string;
}
