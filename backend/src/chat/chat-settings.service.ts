import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatSettingsDto } from './dto/chat-settings.dto';

@Injectable()
export class ChatSettingsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private defaultSettings: ChatSettingsDto = {
    autoTranslate: false,
    readReceipts: false,
    enterToSend: false,
  };

  async getSettings(userId: string): Promise<ChatSettingsDto> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('chat_preferences')
      .eq('id', userId)
      .single();

    if (error || !data?.chat_preferences) {
      return { ...this.defaultSettings };
    }

    const prefs = data.chat_preferences as Partial<ChatSettingsDto>;
    return {
      autoTranslate: prefs.autoTranslate ?? this.defaultSettings.autoTranslate,
      readReceipts: prefs.readReceipts ?? this.defaultSettings.readReceipts,
      enterToSend: prefs.enterToSend ?? this.defaultSettings.enterToSend,
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
    };

    const { error } = await this.supabaseService
      .getClient()
      .from('users')
      .update({
        chat_preferences: merged as unknown as Record<string, unknown>,
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update chat settings: ${error.message}`);
    }

    return merged;
  }
}
