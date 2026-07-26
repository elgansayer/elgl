import { IsOptional, IsString } from 'class-validator';

export class HelpQueryDto {
  @IsOptional()
  @IsString()
  category?: string;
}
