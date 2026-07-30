import {
  IsString,
  IsOptional,
  IsISO8601,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsISO8601()
  date_time!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  language_pair?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  max_participants?: number;
}
