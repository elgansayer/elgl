import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ReleaseMilestoneDto {
  @IsString()
  escrow_id!: string;

  @IsString()
  milestone_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  release_note?: string;
}
