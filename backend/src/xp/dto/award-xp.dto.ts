import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AwardXpDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;
}
