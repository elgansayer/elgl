import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ReportUserDto {
  @IsUUID()
  reported_id!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  reason_category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  context_url?: string;
}
