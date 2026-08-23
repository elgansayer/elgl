import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
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
      throw new ServiceUnavailableException(
        'Chat settings could not be updated',
      );
    }

    return merged;
  }
}
