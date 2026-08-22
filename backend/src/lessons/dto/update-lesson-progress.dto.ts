import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateLessonProgressDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lastPosition?: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
