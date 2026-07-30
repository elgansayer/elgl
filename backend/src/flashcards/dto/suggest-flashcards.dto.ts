import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class SuggestFlashcardsDto {
  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  target_language?: string;

  @IsOptional()
  @IsBoolean()
  exclude_known?: boolean;
}
