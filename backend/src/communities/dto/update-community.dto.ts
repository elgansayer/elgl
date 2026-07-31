import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
