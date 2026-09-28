import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SendChatMediaMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  roomId!: string;

  @IsString()
  @IsIn(['image', 'video'])
  mediaKind!: 'image' | 'video';

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @Matches(
    /^chat-media\/[0-9A-Za-z_-]+\/(image|video)\/(standard|hd)\/[0-9]+-[a-f0-9]{24}\.(jpg|png|webp|mp4|webm|mov)$/,
  )
  objectKey!: string;

  @IsOptional()
  @IsString()
  @IsIn(['standard', 'instant_video'])
  presentation?: 'standard' | 'instant_video';
}
