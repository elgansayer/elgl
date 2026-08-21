import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SimplifyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;
}
