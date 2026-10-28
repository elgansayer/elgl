import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query for `GET /chat/rooms`. Locked rooms stay hidden unless requested. */
export class GetRoomsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  include_locked?: boolean;
}
