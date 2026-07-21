import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportUserDto {
  @IsString()
  @IsNotEmpty()
  reported_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class BlockUserDto {
  @IsString()
  @IsNotEmpty()
  blocked_id!: string;
}
