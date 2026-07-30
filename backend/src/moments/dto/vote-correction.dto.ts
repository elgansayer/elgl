import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class VoteCorrectionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['up', 'down'])
  vote: 'up' | 'down';
}
