import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatSettingsDto } from './dto/chat-settings.dto';
import { InitialMessageFilterDto } from './dto/initial-message-filter.dto';

export interface InitialMessageFilterSettings {
  enabled: boolean;
  min_age?: number;
  max_age?: number;
  native_languages?: string[];
}

@Injectable()
export class ChatSettingsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private defaultSettings: ChatSettingsDto = {
    autoTranslate: false,
    readReceipts: false,
    enterToSend: false,
  };

  private defaultFilterSettings: InitialMessageFilterSettings = {
    enabled: false,
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
      .update({ chat_preferences: merged })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update chat settings: ${error.message}`);
    }

    return merged;
  }

  async getInitialMessageFilter(
    userId: string,
  ): Promise<InitialMessageFilterSettings> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('initial_message_filter')
      .eq('id', userId)
      .single();

    if (error || !data?.initial_message_filter) {
      return { ...this.defaultFilterSettings };
    }

    const filter = data.initial_message_filter as Record<string, unknown>;
    return {
      enabled: Boolean(filter.enabled),
      min_age:
        typeof filter.min_age === 'number' ? filter.min_age : undefined,
      max_age:
        typeof filter.max_age === 'number' ? filter.max_age : undefined,
      native_languages: Array.isArray(filter.native_languages)
        ? (filter.native_languages as string[])
        : undefined,
    };
  }

  async updateInitialMessageFilter(
    userId: string,
    dto: InitialMessageFilterDto,
  ): Promise<InitialMessageFilterSettings> {
    const current = await this.getInitialMessageFilter(userId);

    const merged: Record<string, unknown> = {
      enabled: dto.enabled ?? current.enabled,
    };

    if (dto.min_age !== undefined) {
      merged.min_age = dto.min_age;
    } else if (current.min_age !== undefined) {
      merged.min_age = current.min_age;
    }

    if (dto.max_age !== undefined) {
      merged.max_age = dto.max_age;
    } else if (current.max_age !== undefined) {
      merged.max_age = current.max_age;
    }

    if (dto.native_languages !== undefined) {
      merged.native_languages = dto.native_languages;
    } else if (current.native_languages !== undefined) {
      merged.native_languages = current.native_languages;
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('users')
      .update({ initial_message_filter: merged })
      .eq('id', userId);

    if (error) {
      throw new Error(
        `Failed to update initial message filter: ${error.message}`,
      );
    }

    return {
      enabled: Boolean(merged.enabled),
      min_age:
        typeof merged.min_age === 'number' ? merged.min_age : undefined,
      max_age:
        typeof merged.max_age === 'number' ? merged.max_age : undefined,
      native_languages: Array.isArray(merged.native_languages)
        ? (merged.native_languages as string[])
        : undefined,
    };
  }

  /**
   * Checks whether a sender is allowed to send an initial message to a receiver
   * based on the receiver's initial message filter settings.
   *
   * @returns `true` if the message is allowed, `false` if it should be blocked.
   */
  async checkInitialMessageAllowed(
    receiverId: string,
    senderId: string,
  ): Promise<boolean> {
    const filter = await this.getInitialMessageFilter(receiverId);

    if (!filter.enabled) {
      return true;
    }

    const supabase = this.supabaseService.getClient();

    // Fetch sender's profile for age and native language
    const { data: senderProfile, error } = await supabase
      .from('users')
      .select('birth_date, native_languages')
      .eq('id', senderId)
      .single();

    if (error || !senderProfile) {
      // If we cannot determine sender details, allow by default
      return true;
    }

    // Check age filter
    if (filter.min_age !== undefined || filter.max_age !== undefined) {
      const birthDate = senderProfile.birth_date
        ? new Date(senderProfile.birth_date)
        : null;

      if (birthDate) {
        const now = new Date();
        let age = now.getFullYear() - birthDate.getFullYear();
        const monthDiff = now.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && now.getDate() < birthDate.getDate())
        ) {
          age--;
        }

        if (filter.min_age !== undefined && age < filter.min_age) {
          return false;
        }
        if (filter.max_age !== undefined && age > filter.max_age) {
          return false;
        }
      }
    }

    // Check native language filter
    if (
      filter.native_languages &&
      filter.native_languages.length > 0 &&
      senderProfile.native_languages
    ) {
      const senderLangs: string[] = Array.isArray(
        senderProfile.native_languages,
      )
        ? senderProfile.native_languages
        : [];
      const hasAllowedLanguage = senderLangs.some((lang) =>
        filter.native_languages!.includes(lang),
      );

      if (!hasAllowedLanguage) {
        return false;
      }
    }

    return true;
  }
}
