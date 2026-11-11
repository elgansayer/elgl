import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ReportUserDto {
  @IsString()
  @IsNotEmpty()
  reported_id!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'harassment',
    'spam',
    'inappropriate_content',
    'fake_profile',
    'other',
  ])
  reason_category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  context_url?: string;

  /**
   * Flags one Moment authored by `reported_id`. The report then appears in the
   * moderation queue for flagged Moments instead of only against the member.
   */
  @IsOptional()
  @IsUUID()
  moment_id?: string;
}

export class BlockUserDto {
  @IsString()
  @IsNotEmpty()
  blocked_id!: string;
}

export class UnblockUserDto {
  @IsString()
  @IsNotEmpty()
  blocked_id!: string;
}
export class SilenceUnknownCallersDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsNotEmpty()
  silence!: boolean;
}
