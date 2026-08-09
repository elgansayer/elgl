import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAudioRoomDto {
  @ApiProperty({
    description: 'Title of the audio room (max 100 characters)',
    example: 'Spanish Conversation Practice - All Levels Welcome',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({
    description: 'Target language code for the room',
    example: 'es',
  })
  @IsString()
  @IsNotEmpty()
  target_language!: string;

  @ApiProperty({
    description: 'Language pair identifier (e.g., "en-es")',
    example: 'en-es',
  })
  @IsString()
  @IsNotEmpty()
  language_pair!: string;

  @ApiProperty({
    description: 'Topic tag categorising the room',
    example: 'conversation',
  })
  @IsString()
  @IsNotEmpty()
  topic_tag!: string;

  @ApiPropertyOptional({
    description: 'Whether the room includes video streaming capabilities',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_video_stream?: boolean;

  @ApiPropertyOptional({
    description: 'Language proficiency level for the room',
    example: 'intermediate',
  })
  @IsOptional()
  @IsString()
  level?: string;
}

export class ArchiveRecordingDto {
  @ApiProperty({
    description: 'ID of the audio room',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @ApiProperty({
    description: 'URL of the recording to archive',
    example: 'https://r2.example.com/recordings/room_a1b2c3d4.mp3',
  })
  @IsString()
  @IsNotEmpty()
  recording_url!: string;
}

export class JoinRoomDto {
  @ApiProperty({
    description: 'LiveKit room name to join',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_name!: string;
}

export class RaiseHandDto {
  @ApiProperty({
    description:
      'ID of the audio room where the user wants to raise their hand',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;
}

export class ApproveSpeakerDto {
  @ApiProperty({
    description: 'ID of the audio room',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @ApiProperty({
    description: 'User ID of the speaker to approve onto the stage',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @IsString()
  @IsNotEmpty()
  target_user_id!: string;
}

export class DemoteSpeakerDto {
  @ApiProperty({
    description: 'ID of the audio room',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @ApiProperty({
    description: 'User ID of the speaker to demote from the stage',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @IsString()
  @IsNotEmpty()
  target_user_id!: string;
}

export class SendCaptionDto {
  @ApiProperty({
    description: 'ID of the audio room',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @ApiProperty({
    description: 'Caption text content (max 1000 characters)',
    example: 'Hello, how are you?',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text_content!: string;
}

export class ArchiveRoomDto {
  @ApiProperty({
    description: 'ID of the audio room to archive',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @ApiPropertyOptional({
    description: 'Optional URL of the room recording',
    example: 'https://r2.example.com/recordings/room_a1b2c3d4.mp3',
  })
  @IsOptional()
  @IsString()
  recording_url?: string;
}

export class InviteCoHostDto {
  @ApiProperty({
    description: 'ID of the audio room',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @ApiProperty({
    description: 'User ID to invite as co-host',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @IsString()
  @IsNotEmpty()
  target_user_id!: string;
}

export class DismissRaisedHandDto {
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @IsString()
  @IsNotEmpty()
  target_user_id!: string;
}

export class RemoveCoHostDto {
  @ApiProperty({
    description: 'ID of the audio room',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;
}
