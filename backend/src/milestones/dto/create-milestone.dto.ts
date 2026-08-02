import { IsString, IsOptional } from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
