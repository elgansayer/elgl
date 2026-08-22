import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ListLessonsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  language?: string;
}
