import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { HobbyTagsService } from '../hobby-tags/hobby-tags.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { LessonsService } from '../lessons/lessons.service';
import { MomentsService } from '../moments/moments.service';
import { Flashcard } from '../flashcards/interfaces/flashcard.interface';

export interface CEFRLevel {
  level: string;
}

export interface KnowledgeItem {
  id: string;
  type: 'vocabulary' | 'grammar' | 'phrase';
  status: 'new' | 'learning' | 'known' | 'struggling';
  confidenceScore: number;
  errorFrequency: number;
  sourceIds: {
    flashcardId?: string;
    lessonIds?: string[];
    assessmentIds?: string[];
  };
  lastEncounteredAt: Date;
}

export interface RecentEncounter {
  topic: string;
  source: 'ai_conversation' | 'lesson' | 'moment';
  timestamp: Date;
}

export interface LearnerKnowledgeProfile {
  userId: string;
  language: string;
  overallProficiency: CEFRLevel;
  skills: {
    speaking: number;
    listening: number;
    reading: number;
    writing: number;
    grammar: number;
    vocabulary: number;
  };
  knowledgeItems: Map<string, KnowledgeItem>;
  recentEncounters: RecentEncounter[];
}

@Injectable()
export class LearnerKnowledgeService {
  private readonly logger = new Logger(LearnerKnowledgeService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly flashcardsService: FlashcardsService,
    private readonly hobbyTagsService: HobbyTagsService,
    private readonly assessmentsService: AssessmentsService,
    private readonly lessonsService: LessonsService,
    private readonly momentsService: MomentsService,
  ) {}

  async getProfile(
    userId: string,
    language: string,
  ): Promise<LearnerKnowledgeProfile> {
    this.logger.debug(
      `Fetching unified learner profile for user ${userId} in ${language}`,
    );

    const supabase = this.supabaseService.getClient();

    const { data: profileData, error: profileError } = await supabase
      .from('learner_knowledge_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .maybeSingle();

    if (profileError) {
      this.logger.error(`Error fetching profile for ${userId}: ${profileError.message}`);
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('knowledge_items')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language);

    if (itemsError) {
      this.logger.error(`Error fetching knowledge items for ${userId}: ${itemsError.message}`);
    }

    const { data: encountersData, error: encountersError } = await supabase
      .from('recent_encounters')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .order('encountered_at', { ascending: false })
      .limit(10);

    if (encountersError) {
      this.logger.error(`Error fetching recent encounters for ${userId}: ${encountersError.message}`);
    }

    const knowledgeItems = new Map<string, KnowledgeItem>();
    if (itemsData) {
      for (const item of itemsData) {
        knowledgeItems.set(item.item_id, {
          id: item.item_id,
          type: item.item_type as KnowledgeItem['type'],
          status: item.status as KnowledgeItem['status'],
          confidenceScore: Number(item.confidence_score),
          errorFrequency: Number(item.error_frequency),
          sourceIds: item.source_ids || {},
          lastEncounteredAt: new Date(item.last_encountered_at),
        });
      }
    }

    const recentEncounters: RecentEncounter[] = encountersData
      ? encountersData.map((e) => ({
          topic: e.topic,
          source: e.source as RecentEncounter['source'],
          timestamp: new Date(e.encountered_at),
        }))
      : [];

    return {
      userId,
      language,
      overallProficiency: { level: profileData?.overall_proficiency || 'A1' },
      skills: {
        speaking: Number(profileData?.speaking_score || 0),
        listening: Number(profileData?.listening_score || 0),
        reading: Number(profileData?.reading_score || 0),
        writing: Number(profileData?.writing_score || 0),
        grammar: Number(profileData?.grammar_score || 0),
        vocabulary: Number(profileData?.vocabulary_score || 0),
      },
      knowledgeItems,
      recentEncounters,
    };
  }

  async updateProfile(userId: string, language: string): Promise<void> {
    this.logger.debug(`Recalculating and updating unified learner profile for user ${userId} in ${language}`);

    // Future implementation: Fetch data from flashcardsService, hobbyTagsService, etc.
    // and upsert the aggregated stats into the learner_knowledge_profiles and knowledge_items tables.
  }
}
