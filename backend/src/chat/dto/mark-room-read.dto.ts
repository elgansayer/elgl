import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Body for `POST /chat/rooms/:roomId/read`.
 *
 * One request acknowledges up to 100 messages so opening a busy room does not
 * create a request per message. Ids that are not UUIDs, belong to another room
 * or were sent by the caller are ignored by the service, not rejected.
 */
export class MarkRoomReadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(128, { each: true })
  message_ids!: string[];
}
