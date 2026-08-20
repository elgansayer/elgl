import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ChatSettingsDto,
  MessageFilterSettingsDto,
} from './dto/chat-settings.dto';

@Injectable()
export class ChatSettingsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly defaultMessageFilters: MessageFilterSettingsDto = {
    enabled: false,
    allowEveryone: true,
    allowedGenders: [],
    sameNativeLanguage: false,
    sameTargetLanguage: false,
    sameGender: false,
    sameAge: false,
  };

  private readonly defaultSettings: ChatSettingsDto = {
    autoTranslate: false,
    readReceipts: false,
    enterToSend: false,
    messageFilters: { ...this.defaultMessageFilters },
  };

  private mergeMessageFilters(
    current?: MessageFilterSettingsDto | null,
    incoming?: MessageFilterSettingsDto,
  ): MessageFilterSettingsDto {
    const merged: MessageFilterSettingsDto = {
      ...this.defaultMessageFilters,
      ...(current ?? {}),
      ...(incoming ?? {}),
      allowedGenders: [
        ...new Set(
          (incoming?.allowedGenders ?? current?.allowedGenders ?? []).map((value) =>
            value.trim().toLowerCase(),
          ),
        ),
      ].filter(Boolean),
    };

    if (
      merged.ageMin !== undefined &&
      merged.ageMax !== undefined &&
      merged.ageMin > merged.ageMax
    ) {
      throw new BadRequestException('Minimum age cannot be greater than maximum age.');
    }

    const incomingAddsRestriction = Boolean(
      incoming &&
        ((incoming.allowedGenders?.length ?? 0) > 0 ||
          incoming.sameNativeLanguage ||
          incoming.sameTargetLanguage ||
          incoming.sameGender ||
          incoming.sameAge ||
          incoming.ageMin !== undefined ||
          incoming.ageMax !== undefined),
    );

    // Selecting a concrete restriction implicitly leaves "Everyone" unless
    // the client explicitly sends allowEveryone=true in the same update.
    if (incomingAddsRestriction && incoming?.allowEveryone === undefined) {
      merged.allowEveryone = false;
    }

    // Disabled means no filtering. Keep the explicit Everyone state so a GET
    // round-trip is unambiguous for web/mobile clients.
    if (!merged.enabled) {
      merged.allowEveryone = true;
    }

    return merged;
  }

  async getSettings(userId: string): Promise<ChatSettingsDto> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('chat_preferences, message_filters')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return {
        ...this.defaultSettings,
        messageFilters: { ...this.defaultMessageFilters },
      };
    }

    const prefs = (data.chat_preferences ?? {}) as Partial<ChatSettingsDto>;
    const messageFilters = this.mergeMessageFilters(
      (data.message_filters as MessageFilterSettingsDto | null) ?? null,
    );

    return {
      autoTranslate: prefs.autoTranslate ?? this.defaultSettings.autoTranslate,
      readReceipts: prefs.readReceipts ?? this.defaultSettings.readReceipts,
      enterToSend: prefs.enterToSend ?? this.defaultSettings.enterToSend,
      showDetailedExplanations: prefs.showDetailedExplanations,
      defaultTranslationLanguage: prefs.defaultTranslationLanguage,
      messageFilters,
    };
  }

  async updateSettings(
    userId: string,
    settings: ChatSettingsDto,
  ): Promise<ChatSettingsDto> {
    const current = await this.getSettings(userId);
    const messageFilters = this.mergeMessageFilters(
      current.messageFilters,
      settings.messageFilters,
    );

    const merged: ChatSettingsDto = {
      autoTranslate: settings.autoTranslate ?? current.autoTranslate,
      readReceipts: settings.readReceipts ?? current.readReceipts,
      enterToSend: settings.enterToSend ?? current.enterToSend,
      showDetailedExplanations:
        settings.showDetailedExplanations ?? current.showDetailedExplanations,
      defaultTranslationLanguage:
        settings.defaultTranslationLanguage ?? current.defaultTranslationLanguage,
      messageFilters,
    };

    const chatPreferences = {
      autoTranslate: merged.autoTranslate,
      readReceipts: merged.readReceipts,
      enterToSend: merged.enterToSend,
      showDetailedExplanations: merged.showDetailedExplanations,
      defaultTranslationLanguage: merged.defaultTranslationLanguage,
    };

    const { error } = await this.supabaseService
      .getClient()
      .from('users')
      .update({
        chat_preferences: chatPreferences as unknown as Record<string, unknown>,
        message_filters: messageFilters as unknown as Record<string, unknown>,
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update chat settings: ${error.message}`);
    }

    return merged;
  }
}
