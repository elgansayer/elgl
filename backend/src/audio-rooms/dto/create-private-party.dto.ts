import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateAudioRoomDto } from './audio-room.dto';

export class CreatePrivatePartyDto extends CreateAudioRoomDto {
  @ApiProperty({
    description: 'List of user IDs to invite to the private party',
    type: [String],
    example: ['d290f1ee-6c54-4b01-90e6-d701748f0851'],
    maxItems: 50,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  invited_user_ids!: string[];
}
