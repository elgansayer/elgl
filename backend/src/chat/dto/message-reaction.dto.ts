import { IsBoolean, IsIn, IsString } from 'class-validator';

export const MESSAGE_REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏'] as const;
export type MessageReactionEmoji = (typeof MESSAGE_REACTION_EMOJIS)[number];

export class SetMessageReactionDto {
  @IsString()
  @IsIn(MESSAGE_REACTION_EMOJIS)
  emoji!: MessageReactionEmoji;

  @IsBoolean()
  active!: boolean;
}
