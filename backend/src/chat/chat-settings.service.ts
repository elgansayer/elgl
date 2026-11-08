import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CHAT_TEXT_SIZES,
  ChatSettingsDto,
  ChatTextSize,
  DisappearingMessageTtl,
  DISAPPEARING_MESSAGE_TTLS,
} from './dto/chat-settings.dto';

const DEFAULT_CHAT_TEXT_SIZE: ChatTextSize = 'medium';

@Injectable()
export class ChatSettingsService {
  private readonly logger = new Logger(ChatSettingsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly defaultSettings: ChatSettingsDto = {
    autoTranslate: false,
    readReceipts: false,
    enterToSend: false,
    textSize: DEFAULT_CHAT_TEXT_SIZE,
    disappearingMessagesTtl: 'off',
  };

  private normalizeDisappearingMessagesTtl(
    value: unknown,
  ): DisappearingMessageTtl {
    return typeof value === 'string' &&
      (DISAPPEARING_MESSAGE_TTLS as readonly string[]).includes(value)
      ? (value as DisappearingMessageTtl)
      : 'off';
  }

  /** Anything outside the supported presets falls back to the default size. */
  private normaliseChatTextSize(value: unknown): ChatTextSize {
    return (
      CHAT_TEXT_SIZES.find((size) => size === value) ?? DEFAULT_CHAT_TEXT_SIZE
    );
  }

  async getSettings(userId: string): Promise<ChatSettingsDto> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('chat_preferences')
      .eq('id', userId)
      .single();

    if (error) {
      this.logStoreFailure('read', error.code);
      throw new ServiceUnavailableException(
        'Chat settings are temporarily unavailable',
      );
    }

    if (!data?.chat_preferences) {
      return { ...this.defaultSettings };
    }

    const prefs = data.chat_preferences as Partial<ChatSettingsDto>;
    return {
      autoTranslate: prefs.autoTranslate ?? this.defaultSettings.autoTranslate,
      readReceipts: prefs.readReceipts ?? this.defaultSettings.readReceipts,
      enterToSend: prefs.enterToSend ?? this.defaultSettings.enterToSend,
      textSize: this.normaliseChatTextSize(prefs.textSize),
      disappearingMessagesTtl: this.normalizeDisappearingMessagesTtl(
        prefs.disappearingMessagesTtl,
      ),
    };
  }

  async updateSettings(
    userId: string,
    settings: ChatSettingsDto,
  ): Promise<ChatSettingsDto> {
    const current = await this.getSettings(userId);
    const merged: ChatSettingsDto = {
      autoTranslate: settings.autoTranslate ?? current.autoTranslate,
      readReceipts: settings.readReceipts ?? current.readReceipts,
      enterToSend: settings.enterToSend ?? current.enterToSend,
      textSize: settings.textSize ?? current.textSize,
      disappearingMessagesTtl:
        settings.disappearingMessagesTtl ?? current.disappearingMessagesTtl,
    };

    const { error } = await this.supabaseService
      .getClient()
      .from('users')
      .update({
        chat_preferences: merged as unknown as Record<string, unknown>,
      })
      .eq('id', userId);

    if (error) {
      this.logStoreFailure('write', error.code);
      throw new ServiceUnavailableException(
        'Chat settings could not be updated',
      );
    }

    return merged;
  }

  /**
   * Records a storage failure without the user, the preference payload or the
   * provider message: the code and the request correlation attached by the
   * logger are enough to trace it.
   */
  private logStoreFailure(
    operation: 'read' | 'write',
    providerCode?: string,
  ): void {
    this.logger.warn({
      event: 'chat_settings_store_failure',
      operation,
      providerCode: providerCode || 'unknown',
    });
  }
}
