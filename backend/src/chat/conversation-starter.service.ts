import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';

@Injectable()
export class ConversationStarterService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly llmProxyService: LlmProxyService,
  ) {}

  async getSuggestions(
    _currentUserId: string,
    partnerId: string,
  ): Promise<string[]> {
    // Fetch the partner's public profile from Supabase
    const supabase = this.supabaseService.getClient();

    const { data: partner, error } = await supabase
      .from('users')
      .select('display_name, bio_text, native_language, target_languages')
      .eq('id', partnerId)
      .single();

    if (error || !partner) {
      // fallback to generic conversation starters when profile is unavailable
      return [
        'What got you interested in learning this language?',
        'Do you have a favourite word in your target language?',
        'Have you visited any country where your target language is spoken?',
      ];
    }

    const displayName = partner.display_name ?? partnerId.slice(0, 8);
    const nativeLang = partner.native_language ?? 'English';
    const targetLangs = Array.isArray(partner.target_languages)
      ? partner.target_languages.join(', ')
      : 'a new language';
    const bio = partner.bio_text ?? '';

    // Fetch the partner's interests (from user_interests -> interests)
    const { data: interestsData, error: interestsError } = await supabase
      .from('user_interests')
      .select('interest:interests(name)')
      .eq('user_id', partnerId);

    let interests: string[] = [];
    if (!interestsError && interestsData && interestsData.length > 0) {
      interests = interestsData
        .map((row: any) => row.interest?.name)
        .filter((name: string | null | undefined): name is string => !!name);
    }

    const interestsStr =
      interests.length > 0 ? `- Interests: ${interests.join(', ')}` : '';

    const promptLines: string[] = [
      'You are a friendly language‑exchange assistant. Based on the following user profile, generate exactly three short, natural conversation‑starter questions (one per line). The questions should help a language‑exchange partner begin a chat.',
      `- Name: ${displayName}`,
      `- Native language: ${nativeLang}`,
      `- Target languages: ${targetLangs}`,
      `- Bio: "${bio}"`,
    ];
    if (interestsStr) {
      promptLines.push(interestsStr);
    }
    promptLines.push(
      'Return only the three questions, one on each line, without numbering or extra text.',
    );

    const prompt = promptLines.join('\n');

    try {
      const { response } = await this.llmProxyService.proxyMessage(prompt);
      const lines = response
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);
      // ensure we always return at most three items
      return lines.slice(0, 3);
    } catch {
      // fallback when the LLM is unreachable
      const fallbackQuestions: string[] = [];
      if (interests.length > 0) {
        fallbackQuestions.push(
          `I see you're interested in ${interests[0]}. What drew you to that topic?`,
        );
      }
      fallbackQuestions.push(
        `What made you choose ${targetLangs} as a language to learn?`,
      );
      fallbackQuestions.push(
        `Hi ${displayName}, do you have any favourite traditions in the ${nativeLang}-speaking world?`,
      );
      if (bio) {
        fallbackQuestions.push(
          `I saw your bio says "${bio.slice(0, 50)}" – that sounds interesting!`,
        );
      } else {
        fallbackQuestions.push('What do you enjoy doing in your free time?');
      }
      return fallbackQuestions.slice(0, 3);
    }
  }
}
