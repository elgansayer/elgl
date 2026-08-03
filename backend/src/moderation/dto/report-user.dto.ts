import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ReportUserDto {
  @IsString()
  @IsNotEmpty()
  reportedUserId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
