import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { DEFAULT_UI_LOCALE, SUPPORTED_UI_LOCALES } from './backend-dictionary';
import { normalizeBackendLocale, translateBackendCopy } from './translate';

export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  normalizeLocale(locale?: string | null): string {
    return normalizeBackendLocale(locale);
  }

  translate(
    key: string,
    locale?: string | null,
    params?: Record<string, string | number>,
  ): string {
    return translateBackendCopy(key, locale, params);
  }

  async resolveUserLocale(userId: string): Promise<string> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('users')
        .select('ui_locale')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return DEFAULT_UI_LOCALE;
      return normalizeBackendLocale(data.ui_locale);
    } catch (error) {
      this.logger.warn(
        `Falling back to ${DEFAULT_UI_LOCALE} after locale lookup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return DEFAULT_UI_LOCALE;
    }
  }
}
