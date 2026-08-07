import {
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsString,
} from 'class-validator';

export class InitialMessageFilterDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(120)
  min_age?: number;

  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(120)
  max_age?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  native_languages?: string[];
}