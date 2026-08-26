import 'reflect-metadata';
import {
  IsOptional,
  IsString,
  IsISO8601,
  IsInt,
  Min,
  Max,
  IsIn,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EventsQueryDto {
  @IsOptional()
  @IsString()
  language_pair?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'audio_room',
    'learning_seminar',
    'in_person_meetup',
    'cultural_exchange',
  ])
  category?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(upcoming|past)$/)
  status?: 'upcoming' | 'past';

  @IsOptional()
  @IsISO8601()
  from_date?: string;

  @IsOptional()
  @IsISO8601()
  to_date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  proficiency?: 'Beginner' | 'Intermediate' | 'Advanced';
}
