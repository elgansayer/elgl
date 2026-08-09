import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateLanguageIslandDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  language_pair!: string;

  @IsOptional()
  @IsInt()
  max_members?: number;
}
