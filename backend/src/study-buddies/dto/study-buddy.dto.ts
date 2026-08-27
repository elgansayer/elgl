import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class StudyBuddyRequestDto {
  @IsUUID()
  partnerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
