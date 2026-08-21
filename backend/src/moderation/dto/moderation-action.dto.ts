import { IsString, IsIn, IsOptional } from 'class-validator';

export class ModerationActionDto {
  @IsString()
  itemId!: string;

  @IsString()
  @IsIn(['moment', 'profile'])
  type!: 'moment' | 'profile';

  @IsString()
  @IsOptional()
  reason?: string;
}
