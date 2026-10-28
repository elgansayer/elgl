import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MESSAGE_PAGE_SIZE_MAX = 100;

/**
 * Query for `GET /chat/messages/:roomId`.
 *
 * The endpoint returns the newest `limit` messages in ascending order. Older
 * history is fetched by passing the `created_at` of the oldest message already
 * loaded as `before`, so every response stays bounded.
 */
export class GetMessagesQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(200)
  search?: string;

  /** Only messages created strictly before this ISO 8601 timestamp are returned. */
  @IsOptional()
  @IsISO8601({ strict: true })
  before?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : value,
  )
  @IsInt()
  @Min(1)
  @Max(MESSAGE_PAGE_SIZE_MAX)
  limit = MESSAGE_PAGE_SIZE_MAX;
}
