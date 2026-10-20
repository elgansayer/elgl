import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const EVENT_CATEGORIES = [
  'audio_room',
  'learning_seminar',
  'in_person_meetup',
  'cultural_exchange',
] as const;

export const EVENT_VENUE_TYPES = ['audio_room', 'zoom', 'in_person'] as const;

export type EventVenueType = (typeof EVENT_VENUE_TYPES)[number];

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEventDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @IsIn([...EVENT_CATEGORIES])
  category?: string;

  @IsISO8601({ strict: true })
  date_time!: string;

  @IsString()
  @IsIn([...EVENT_VENUE_TYPES])
  venue_type!: EventVenueType;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  location!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(32)
  language_pair?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  max_participants?: number;
}
