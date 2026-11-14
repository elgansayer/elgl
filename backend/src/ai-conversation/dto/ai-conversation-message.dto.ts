import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PROMPT_LIMITS } from '../../llm-guard/prompt-guard';

/** The only roles a client may supply: it can never speak as the system. */
export const AI_CONVERSATION_TURN_ROLES = ['user', 'assistant'] as const;

/** The web client sends the last ten turns; leave headroom without allowing abuse. */
export const MAX_AI_CONVERSATION_HISTORY_TURNS = 50;

export class AiConversationTurnDto {
  @IsIn(AI_CONVERSATION_TURN_ROLES)
  role!: (typeof AI_CONVERSATION_TURN_ROLES)[number];

  @IsString()
  @MaxLength(PROMPT_LIMITS.maxUserMessageChars)
  content!: string;
}

export class AiConversationMessageDto {
  /** Optional so a blank message keeps its friendly "say something" reply. */
  @IsOptional()
  @IsString()
  @MaxLength(PROMPT_LIMITS.maxUserMessageChars)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  scenarioId?: string | null;

  @IsOptional()
  @IsUUID()
  botId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_AI_CONVERSATION_HISTORY_TURNS)
  @ValidateNested({ each: true })
  @Type(() => AiConversationTurnDto)
  conversationHistory?: AiConversationTurnDto[];
}
