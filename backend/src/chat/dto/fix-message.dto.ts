import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FixMessageDto {
  @IsString()
  @MaxLength(4000)
  correctedText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  explanation?: string;
}
