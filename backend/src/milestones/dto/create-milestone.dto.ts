import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200, { message: 'Title must be between 1 and 200 characters.' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
