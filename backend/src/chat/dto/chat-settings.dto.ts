import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class MessageFilterSettingsDto {
  /** Disable all unsolicited-message filtering when false. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Explicit "Everyone" choice. When true all other filters are ignored. */
  @IsOptional()
  @IsBoolean()
  allowEveryone?: boolean;

  /** Optional explicit gender allow-list, e.g. ["man", "woman"]. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedGenders?: string[];

  @IsOptional()
  @IsBoolean()
  sameNativeLanguage?: boolean;

  @IsOptional()
  @IsBoolean()
  sameTargetLanguage?: boolean;

  @IsOptional()
  @IsBoolean()
  sameGender?: boolean;

  @IsOptional()
  @IsBoolean()
  sameAge?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  ageMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  ageMax?: number;
}

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

  /** Controls who may start a new direct-message conversation with the user. */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MessageFilterSettingsDto)
  messageFilters?: MessageFilterSettingsDto;
}
