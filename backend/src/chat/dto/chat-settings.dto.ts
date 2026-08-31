import { IsBoolean, IsOptional, IsString } from 'class-validator';

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
