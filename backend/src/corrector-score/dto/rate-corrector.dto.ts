import { IsNumber, IsUUID, Min, Max } from 'class-validator';

export class RateCorrectorDto {
  @IsUUID()
  rated_user_id!: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  score!: number;
}
