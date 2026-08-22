import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type QuestType = 'daily' | 'weekly';
export type QuestKey = 'correct_moments' | 'post_moment';

export interface Quest {
  id: string;
  user_id: string;
  quest_type: QuestType;
  quest_key: QuestKey;
  progress: number;
  target: number;
  reward_coins: number;
  completed: boolean;
  period_start: string;
  reward_claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface QuestRpcResult {
  data: unknown;
  error: { message?: string } | null;
}

interface QuestRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<QuestRpcResult>;
}

const QUEST_KEYS = new Set<QuestKey>(['correct_moments', 'post_moment']);
const MAX_PROGRESS_INCREMENT = 100;

@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getQuests(userId: string): Promise<Quest[]> {
    const rpcClient = this.getRpcClient();
    const { data, error } = await rpcClient.rpc('get_or_create_user_quests', {
      p_user_id: userId,
    });

    if (error) {
      this.logger.error('Failed to load current quest periods');
      throw new InternalServerErrorException('Unable to load quests');
    }

    return ((data ?? []) as Quest[]).map((quest) => ({
      ...quest,
      progress: Math.max(0, Math.min(quest.progress ?? 0, quest.target)),
    }));
  }

  // Backward-compatible alias for older callers while the API continues to
  // return both daily and weekly quests from GET /quests.
  async getDailyQuests(userId: string): Promise<Quest[]> {
    return this.getQuests(userId);
  }

  async incrementProgress(
    userId: string,
    questKey: string,
    amount = 1,
  ): Promise<void> {
    if (!QUEST_KEYS.has(questKey as QuestKey)) {
      throw new BadRequestException('Unknown quest key');
    }
    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > MAX_PROGRESS_INCREMENT
    ) {
      throw new BadRequestException('Quest progress amount must be 1 to 100');
    }

    const rpcClient = this.getRpcClient();
    const { error } = await rpcClient.rpc('advance_user_quests', {
      p_user_id: userId,
      p_quest_key: questKey,
      p_amount: amount,
    });

    if (error) {
      this.logger.error('Failed to atomically advance quest progress');
      throw new InternalServerErrorException('Unable to update quest progress');
    }
  }

  private getRpcClient(): QuestRpcClient {
    return this.supabaseService.getClient() as unknown as QuestRpcClient;
  }
}
