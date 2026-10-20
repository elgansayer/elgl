import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ListChallengesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset = 0;
}
