import { IsOptional, IsString } from 'class-validator';

export class CulturalTagFilterDto {
  @IsOptional()
  @IsString()
  tags?: string;
}
