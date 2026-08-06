import { IsString, IsOptional, IsNotEmpty, IsIn, MaxLength } from 'class-validator';

export class ReportUserDto {
  @IsString()
  @IsNotEmpty()
  reportedUserId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'harassment',
    'spam',
    'inappropriate_content',
    'fake_profile',
    'other',
  ])
  reasonCategory!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
