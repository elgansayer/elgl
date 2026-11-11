import { IsInt, IsUUID, Min, Max } from 'class-validator';

export class RateCorrectorDto {
  @IsUUID()
  rated_user_id!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}
