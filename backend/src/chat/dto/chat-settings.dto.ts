import { IsBoolean, IsOptional } from 'class-validator';

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
}
