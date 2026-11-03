import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export const SEND_CHAT_MEDIA_KINDS = ['image', 'video', 'doodle'] as const;
export type SendChatMediaKind = (typeof SEND_CHAT_MEDIA_KINDS)[number];

/**
 * Keys minted by `ChatMediaUploadService`. Photos and videos carry a quality
 * segment and any supported container extension. Doodles are always standard
 * quality PNG exports, so their alternative is deliberately narrower.
 */
export const CHAT_MEDIA_OBJECT_KEY_PATTERN =
  /^chat-media\/[0-9A-Za-z_-]+\/(?:(?:image|video)\/(?:standard|hd)\/[0-9]+-[a-f0-9]{24}\.(?:jpg|png|webp|mp4|webm|mov)|doodle\/standard\/[0-9]+-[a-f0-9]{24}\.png)$/;

export class SendChatMediaMessageDto {
  // Room membership is stored against a UUID column. Validating the shape here keeps a
  // malformed id a permanent 400 instead of a database error surfaced as a retryable 503.
  @IsUUID()
  roomId!: string;

  @IsString()
  @IsIn(SEND_CHAT_MEDIA_KINDS)
  mediaKind!: SendChatMediaKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @Matches(CHAT_MEDIA_OBJECT_KEY_PATTERN)
  objectKey!: string;

  @IsOptional()
  @IsString()
  @IsIn(['standard', 'instant_video'])
  presentation?: 'standard' | 'instant_video';
}
