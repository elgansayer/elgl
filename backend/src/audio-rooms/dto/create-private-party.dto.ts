import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateAudioRoomDto } from './audio-room.dto';

export class CreatePrivatePartyDto extends CreateAudioRoomDto {
  @ApiProperty({
    description: 'List of user IDs to invite to the private party',
    type: [String],
    example: ['d290f1ee-6c54-4b01-90e6-d701748f0851'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  invited_user_ids!: string[];
}
