import { IsUUID } from 'class-validator';

export class ConversationAnalysisDto {
  @IsUUID()
  room_id!: string;

  @IsUUID()
  idempotency_key!: string;
}

export type PremiumAiServiceKey = 'conversation_analysis_report';

export interface PremiumAiServiceCatalogItem {
  key: PremiumAiServiceKey;
  name: string;
  description: string;
  cost_coins: number;
}

export interface ConversationAnalysisResult {
  run_id: string;
  service_key: PremiumAiServiceKey;
  cost_coins: number;
  coins_remaining: number;
  status: 'completed';
  report: string;
  message_count: number;
  reused: boolean;
}
