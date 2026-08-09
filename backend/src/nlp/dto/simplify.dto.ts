import { IsString, IsNotEmpty } from 'class-validator';

export class SimplifyDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}
