import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { CreateAudioRoomDto } from './audio-room.dto';

export class CreatePrivatePartyDto extends CreateAudioRoomDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  invited_user_ids!: string[];
}
