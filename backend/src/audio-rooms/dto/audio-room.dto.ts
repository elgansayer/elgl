import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAudioRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  target_language!: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  room_name!: string;
}

export class RaiseHandDto {
  @IsString()
  @IsNotEmpty()
  room_id!: string;
}

export class ApproveSpeakerDto {
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @IsString()
  @IsNotEmpty()
  target_user_id!: string;
}

export class SendCaptionDto {
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text_content!: string;
}

export class ArchiveRoomDto {
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @IsOptional()
  @IsString()
  recording_url?: string;
}
