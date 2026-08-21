import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { ChatMessageEvent } from '../notifications/events/notification.events';

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
    const prompt = `Give me a short daily learning tip (1-2 sentences) for someone learning ${lang}. Include practical advice. Do not include greetings.`;
    try {
      const { response } = await this.llmProxyService.proxyMessage(prompt);
      return response?.trim() ?? 'Keep practising every day!';
    } catch {
      return 'Keep practising every day!';
    }
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

    for (const user of users ?? []) {
      const lang = user.target_languages?.[0] ?? user.native_language ?? 'en';
      const prompt = `Give me a short daily learning tip (1-2 sentences) for someone learning ${lang}. Include practical advice. Do not include greetings.`;

      try {
        const { response } = await this.llmProxyService.proxyMessage(prompt);
        const tipText = response?.trim() ?? 'Keep practising every day!';

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
    }
  }
}
