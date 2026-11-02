import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ChatTextSize,
  ChatSettingsDto,
  DisappearingMessageTtl,
  DISAPPEARING_MESSAGE_TTLS,
} from './dto/chat-settings.dto';

@Injectable()
export class ChatSettingsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly defaultSettings: ChatSettingsDto = {
    autoTranslate: false,
    readReceipts: false,
    enterToSend: false,
    textSize: 'medium',
    disappearingMessagesTtl: 'off',
  };

  private normaliseChatTextSize(value: unknown): ChatTextSize {
    return value === 'small' || value === 'large' ? value : 'medium';
  }

  private normaliseBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private normalizeDisappearingMessagesTtl(
    value: unknown,
  ): DisappearingMessageTtl {
    return typeof value === 'string' &&
      (DISAPPEARING_MESSAGE_TTLS as readonly string[]).includes(value)
      ? (value as DisappearingMessageTtl)
      : 'off';
  }

  async getSettings(userId: string): Promise<ChatSettingsDto> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('chat_preferences')
      .eq('id', userId)
      .single();

    if (error) {
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
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('merge_chat_preferences', {
        p_user_id: userId,
        p_patch: settings,
      });

    if (error || !data) {
      throw new ServiceUnavailableException(
        'Chat settings could not be updated',
      );
    }

    return {
      autoTranslate: this.normaliseBoolean(
        data.autoTranslate,
        this.defaultSettings.autoTranslate ?? false,
      ),
      readReceipts: this.normaliseBoolean(
        data.readReceipts,
        this.defaultSettings.readReceipts ?? false,
      ),
      enterToSend: this.normaliseBoolean(
        data.enterToSend,
        this.defaultSettings.enterToSend ?? false,
      ),
      textSize: this.normaliseChatTextSize(data.textSize),
      disappearingMessagesTtl: this.normalizeDisappearingMessagesTtl(
        data.disappearingMessagesTtl,
      ),
    };
  }
}
