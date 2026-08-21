import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

export interface TargetVocabularyItem {
  word: string;
  translation: string;
  language: string;
}

export interface BaseVocabularyItem {
  word: string;
  context?: string;
}

export interface VocabularyResultItem {
  id: string;
  word: string;
  translation: string;
  hobbyTagName: string;
  difficulty: string;
  context_sentence?: string;
  hobby_tag: { icon: string; name: string };
}

const TAG_BASE_VOCABULARY: Record<string, BaseVocabularyItem[]> = {
  Cooking: [
    { word: 'recipe' },
    { word: 'ingredient' },
    { word: 'simmer' },
    { word: 'chop' },
    { word: 'bake' },
  ],
  Travel: [
    { word: 'destination' },
    { word: 'itinerary' },
    { word: 'accommodation' },
    { word: 'sightseeing' },
    { word: 'backpack' },
  ],
  Fitness: [
    { word: 'workout' },
    { word: 'repetition' },
    { word: 'stretch' },
    { word: 'endurance' },
    { word: 'nutrition' },
  ],
  Music: [
    { word: 'melody' },
    { word: 'rhythm' },
    { word: 'instrument' },
    { word: 'concert' },
    { word: 'compose' },
  ],
  Gaming: [
    { word: 'achievement' },
    { word: 'multiplayer' },
    { word: 'strategy' },
    { word: 'level up' },
    { word: 'quest' },
  ],
  Photography: [
    { word: 'aperture' },
    { word: 'exposure' },
    { word: 'composition' },
    { word: 'landscape' },
    { word: 'portrait' },
  ],
  Reading: [
    { word: 'chapter' },
    { word: 'plot' },
    { word: 'character' },
    { word: 'novel' },
    { word: 'genre' },
  ],
  Technology: [
    { word: 'algorithm' },
    { word: 'database' },
    { word: 'debug' },
    { word: 'framework' },
    { word: 'encryption' },
  ],
  Sports: [
    { word: 'team' },
    { word: 'score' },
    { word: 'penalty' },
    { word: 'tournament' },
    { word: 'champion' },
  ],
};

function isTargetVocabularyItem(value: unknown): value is TargetVocabularyItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'word' in value &&
    'translation' in value &&
    'language' in value
  );
}

@Injectable()
export class HobbyTagsService {
  private readonly logger = new Logger(HobbyTagsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private getBaseVocabulary(tagName: string): BaseVocabularyItem[] {
    return TAG_BASE_VOCABULARY[tagName] || [];
  }

  async getAllTags(): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('hobby_tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createTag(
    name: string,
    category: string,
    icon: string = '✨',
  ): Promise<any> {
    const formattedName = name
      .trim()
      .split(/\s+/)
      .map((word, index) => {
        if (index === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');

    const supabase = this.supabaseService.getClient();
    const insertResponse = await supabase
      .from('hobby_tags')
      .insert({
        name: formattedName,
        category,
        icon,
        target_vocabulary: [],
      })
      .select()
      .single();

    if (insertResponse.error) throw insertResponse.error;
    return insertResponse.data;
  }

  async getUserTags(userId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('user_hobby_tags')
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  }

  async addUserTag(
    userId: string,
    hobbyTagId: string,
    proficiencyLevel?: number,
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();

    const { data: tag, error: tagError } = await supabase
      .from('hobby_tags')
      .select('id')
      .eq('id', hobbyTagId)
      .single();

    if (tagError || !tag) {
      throw new NotFoundException('Hobby tag not found');
    }

    const { data: existing } = await supabase
      .from('user_hobby_tags')
      .select('id')
      .eq('user_id', userId)
      .eq('hobby_tag_id', hobbyTagId)
      .single();

    if (existing) {
      throw new ConflictException('Hobby tag already added');
    }

    const insertResponse = await supabase
      .from('user_hobby_tags')
      .insert({
        user_id: userId,
        hobby_tag_id: hobbyTagId,
        proficiency_level: proficiencyLevel || 0,
      })
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .single();

    if (insertResponse.error) throw insertResponse.error;
    return insertResponse.data;
  }

  async removeUserTag(userId: string, hobbyTagId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('user_hobby_tags')
      .delete()
      .eq('user_id', userId)
      .eq('hobby_tag_id', hobbyTagId);

    if (error) throw error;
  }

  async updateProficiency(
    userId: string,
    hobbyTagId: string,
    proficiencyLevel: number,
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const updateResponse = await supabase
      .from('user_hobby_tags')
      .update({ proficiency_level: proficiencyLevel })
      .eq('user_id', userId)
      .eq('hobby_tag_id', hobbyTagId)
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .single();

    if (updateResponse.error) throw updateResponse.error;
    if (!updateResponse.data)
      throw new NotFoundException('User hobby tag not found');
    return updateResponse.data;
  }

  private async translateVocabulary(
    sourceWords: string[],
    targetLanguage: string,
  ): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    if (!sourceWords.length) return translations;

    const deepLKey = this.configService.get<string>('DEEPL_API_KEY');

    if (!deepLKey) {
      this.logger.warn(
        'DeepL API key not configured, skipping vocabulary translation',
      );
      return translations;
    }

    try {
      const res = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${deepLKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sourceWords,
          source_lang: 'EN',
          target_lang: targetLanguage.toUpperCase(),
        }),
      });

      if (!res.ok) {
        this.logger.warn(`DeepL translation failed: ${res.status}`);
        return translations;
      }

      const json = (await res.json()) as {
        translations: Array<{ text: string; detected_source_language: string }>;
      };

      if (json.translations) {
        json.translations.forEach((t, i) => {
          translations.set(sourceWords[i], t.text);
        });
      }
    } catch (err) {
      this.logger.warn(`DeepL translation error: ${err}`);
    }

    return translations;
  }

  async getVocabularyForUser(
    userId: string,
    language: string,
  ): Promise<VocabularyResultItem[]> {
    const supabase = this.supabaseService.getClient();
    const { data: userHobbyTags, error } = await supabase
      .from('user_hobby_tags')
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .eq('user_id', userId);

    if (error) throw error;
    if (!userHobbyTags || userHobbyTags.length === 0) return [];

    const results: VocabularyResultItem[] = [];
    const tagsNeedingTranslation: Array<{
      hobbyTagId: string;
      tagName: string;
      existingVocab: TargetVocabularyItem[];
      userHobbyTagId: string;
      icon: string;
    }> = [];

    for (const uht of userHobbyTags) {
      const hobbyTag = uht.hobby_tag;
      if (!hobbyTag) continue;

      const rawVocab = Array.isArray(hobbyTag.target_vocabulary)
        ? hobbyTag.target_vocabulary
        : [];
      const targetVocab: TargetVocabularyItem[] = rawVocab.filter(
        isTargetVocabularyItem,
      );

      const cachedVocab = targetVocab.filter((v) => v.language === language);

      if (cachedVocab.length > 0) {
        for (const vocabItem of cachedVocab) {
          results.push({
            id: `${uht.id}-${vocabItem.word}`,
            word: vocabItem.word,
            translation: vocabItem.translation,
            hobbyTagName: hobbyTag.name,
            difficulty: 'beginner',
            context_sentence: undefined,
            hobby_tag: {
              icon: hobbyTag.icon || '🎯',
              name: hobbyTag.name,
            },
          });
        }
      } else {
        const baseVocab = this.getBaseVocabulary(hobbyTag.name);
        if (baseVocab.length > 0) {
          tagsNeedingTranslation.push({
            hobbyTagId: hobbyTag.id,
            tagName: hobbyTag.name,
            existingVocab: targetVocab,
            userHobbyTagId: uht.id,
            icon: hobbyTag.icon || '🎯',
          });
        }
      }
    }

    if (tagsNeedingTranslation.length > 0) {
      const wordToTagMap = new Map<string, string[]>();

      for (const tnt of tagsNeedingTranslation) {
        const baseVocab = this.getBaseVocabulary(tnt.tagName);
        for (const bv of baseVocab) {
          let tags = wordToTagMap.get(bv.word);
          if (!tags) {
            tags = [];
            wordToTagMap.set(bv.word, tags);
          }
          tags.push(tnt.tagName);
        }
      }

      const allBaseWords = Array.from(wordToTagMap.keys());

      const translations = await this.translateVocabulary(
        allBaseWords,
        language,
      );

      for (const tnt of tagsNeedingTranslation) {
        const baseVocab = this.getBaseVocabulary(tnt.tagName);
        const newVocabItems: TargetVocabularyItem[] = [];

        for (const bv of baseVocab) {
          const translation = translations.get(bv.word) || bv.word;
          newVocabItems.push({
            word: bv.word,
            translation,
            language,
          });

          results.push({
            id: `${tnt.userHobbyTagId}-${bv.word}`,
            word: bv.word,
            translation,
            hobbyTagName: tnt.tagName,
            difficulty: 'beginner',
            context_sentence: undefined,
            hobby_tag: {
              icon: tnt.icon,
              name: tnt.tagName,
            },
          });
        }

        const updatedVocab = [...tnt.existingVocab, ...newVocabItems];

        setImmediate(() => {
          void (async () => {
            try {
              await supabase
                .from('hobby_tags')
                .update({ target_vocabulary: updatedVocab })
                .eq('id', tnt.hobbyTagId);
            } catch (err) {
              this.logger.warn(
                `Failed to cache vocabulary for tag ${tnt.tagName}: ${err}`,
              );
            }
          })();
        });
      }
    }

    return results;
  }

  async getUserVocabulary(
    userId: string,
    language: string,
  ): Promise<VocabularyResultItem[]> {
    return this.getVocabularyForUser(userId, language || 'en');
  }

  async getVocabularyForTag(
    tagId: string,
    language: string,
  ): Promise<VocabularyResultItem[]> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('hobby_tags')
      .select('*')
      .eq('id', tagId)
      .single();
    if (!data) return [];
    return this.getBaseVocabulary(data.name).map((item, index) => ({
      id: `${tagId}-${index}`,
      word: item.word,
      translation: item.word,
      language: language || 'en',
      hobbyTagName: data.name,
      difficulty: 'beginner',
      hobby_tag: { icon: data.icon ?? '✨', name: data.name },
    }));
  }
}
