import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import {
  buildDataPrompt,
  requireScreenedReply,
} from '../llm-guard/prompt-guard';
import { ChatMessageEvent } from '../notifications/events/notification.events';

const DEFAULT_TIP = 'Keep practising every day!';
const MAX_TIP_CHARS = 500;

const DAILY_TIP_INSTRUCTIONS = [
  'Give a short daily language-learning tip in one or two sentences.',
  'Include practical advice and do not include greetings.',
  'Respond only with the tip text.',
];

@Injectable()
export class DailyTipService {
  private readonly logger = new Logger(DailyTipService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly llmProxyService: LlmProxyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getTodayTipForUser(userId: string): Promise<string> {
    const supabase = this.supabaseService.getClient();
    const {
      data: user,
    }: {
      data: { target_languages: string[]; native_language: string } | null;
    } = await supabase
      .from('users')
      .select('target_languages, native_language')
      .eq('id', userId)
      .single();
    const lang = user?.target_languages?.[0] ?? user?.native_language ?? 'en';
    try {
      return await this.generateTip(lang);
    } catch {
      return DEFAULT_TIP;
    }
  }

  private async generateTip(language: string): Promise<string> {
    const response = await this.llmProxyService.chatCompletion(
      buildDataPrompt({
        tool: 'daily_tip',
        instructions: DAILY_TIP_INSTRUCTIONS,
        data: { language },
      }),
    );
    return requireScreenedReply(response, { maxLength: MAX_TIP_CHARS });
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async generateDailyTips(): Promise<void> {
    this.logger.log('Starting daily learning tip generation…');
    const supabase = this.supabaseService.getClient();

    const {
      data: users,
      error,
    }: {
      data:
        | { id: string; target_languages: string[]; native_language: string }[]
        | null;
      error: PostgrestError | null;
    } = await supabase
      .from('users')
      .select('id, target_languages, native_language');

    if (error) {
      this.logger.error('Failed to fetch users', error.message);
      return;
    }

    const safeUsers = users ?? [];
    // ⚡ Bolt Optimization: Replace sequential await loop with bounded concurrent chunks
    // Process up to 10 users concurrently to significantly improve API latency
    // while preventing unbounded Promise.allSettled calls from exhausting concurrent request limits.
    const chunkSize = 10;
    for (let i = 0; i < safeUsers.length; i += chunkSize) {
      const chunk = safeUsers.slice(i, i + chunkSize);

      await Promise.allSettled(
        chunk.map(async (user) => {
          const lang =
            user.target_languages?.[0] ?? user.native_language ?? 'en';
          try {
            const tipText = await this.generateTip(lang);

            // Emit a push notification via the existing notification system
            const event = new ChatMessageEvent(
              'system', // sender id (a virtual system sender)
              user.id, // receiver
              '', // room id (not used for push)
              'text', // message type
              tipText.substring(0, 120), // notification preview
            );
            this.eventEmitter.emit('chat.message', event);
            this.logger.log(`Daily tip sent to user ${user.id}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Failed to generate tip for user ${user.id}: ${message}`,
            );
          }
        }),
      );
    }
  }
}
