import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export const DISAPPEARING_MESSAGE_TTLS = ['off', '24h', '7d', '90d'] as const;
export type DisappearingMessageTtl = (typeof DISAPPEARING_MESSAGE_TTLS)[number];
export const CHAT_TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type ChatTextSize = (typeof CHAT_TEXT_SIZES)[number];

export class ChatSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoTranslate?: boolean;

  @IsOptional()
  @IsBoolean()
  readReceipts?: boolean;

  @IsOptional()
  @IsBoolean()
  enterToSend?: boolean;

  @IsOptional()
  @IsIn(CHAT_TEXT_SIZES)
  textSize?: ChatTextSize;

  /**
   * Default retention applied to newly-sent chat messages. Existing messages
   * keep the expiry they were assigned at send time.
   */
  @IsOptional()
  @IsIn(DISAPPEARING_MESSAGE_TTLS)
  disappearingMessagesTtl?: DisappearingMessageTtl;

  /**
   * When enabled, the UI will show detailed explanations (grammar notes,
   * alternative translations, and context hints) alongside correction
   * or translation results.
   */
  @IsOptional()
  @IsBoolean()
  showDetailedExplanations?: boolean;

  /**
   * The ISO 639-1 language code for the default target language
   * when automatic translation is enabled.
   */
  @IsOptional()
  @IsString()
  defaultTranslationLanguage?: string;
}
