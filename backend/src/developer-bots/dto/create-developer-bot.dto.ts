import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CUSTOM_BOT_TONES } from '../interfaces/custom-bot.interface';

const BCP47_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

export class CreateDeveloperBotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  display_name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  persona!: string;

  @IsString()
  @Matches(BCP47_PATTERN, {
    message: 'target_language must be a BCP-47 language tag',
  })
  target_language!: string;

  @IsIn(CUSTOM_BOT_TONES)
  tone!: (typeof CUSTOM_BOT_TONES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  greeting?: string;

  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;
}
