import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class SaveLessonProgressDto {
  @IsInt()
  @Min(0)
  @Max(10000)
  segment_index!: number;

  @IsBoolean()
  completed!: boolean;
}
