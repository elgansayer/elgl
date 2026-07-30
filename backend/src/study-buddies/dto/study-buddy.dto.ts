import { IsString, IsOptional } from 'class-validator';

export class StudyBuddyRequestDto {
  @IsString()
  partnerId!: string;

  @IsOptional()
  @IsString()
  message?: string;
}
