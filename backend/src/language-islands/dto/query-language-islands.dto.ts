import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryLanguageIslandsDto {
  @IsOptional()
  @IsString()
  language_pair?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  host_only?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
