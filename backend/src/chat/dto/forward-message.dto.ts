import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

/**
 * Target rooms for a single forwarding action.
 *
 * Keep fan-out deliberately small: forwarding is user-triggered and each target
 * creates a persisted message plus realtime/push delivery work.
 */
export class ForwardMessageDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  room_ids!: string[];
}
