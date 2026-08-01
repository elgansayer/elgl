import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
