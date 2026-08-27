import { IsString, IsOptional, IsInt } from 'class-validator';

export class UpdateLanguageIslandDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  language_pair?: string;

  @IsOptional()
  @IsInt()
  max_members?: number;
}
