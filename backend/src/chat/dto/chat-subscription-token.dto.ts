import { IsIn, IsString, IsUUID } from 'class-validator';

export const CHAT_SUBSCRIPTION_STREAMS = ['messages', 'typing'] as const;
export type ChatSubscriptionStream = (typeof CHAT_SUBSCRIPTION_STREAMS)[number];

/** Body for minting a membership-scoped Centrifugo subscription token. */
export class ChatSubscriptionTokenDto {
  @IsUUID()
  room_id!: string;

  @IsString()
  @IsIn(CHAT_SUBSCRIPTION_STREAMS)
  stream!: ChatSubscriptionStream;
}
