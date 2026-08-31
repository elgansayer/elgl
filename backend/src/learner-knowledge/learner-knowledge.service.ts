import { Injectable, Logger } from '@nestjs/common';
import { VocabularyResultItem } from '../hobby-tags/hobby-tags.service';
import { LessonRecord } from '../lessons/lessons.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { HobbyTagsService } from '../hobby-tags/hobby-tags.service';
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
  globalProficiency: CEFRLevel;
  globalSkills: {
    speaking: number;
    listening: number;
    reading: number;
    writing: number;
    grammar: number;
    vocabulary: number;
  };
  globalKnowledgeItems: Map<string, KnowledgeItem>;
  languageKnowledgeItems: Map<string, KnowledgeItem>;
  globalRecentEncounters: RecentEncounter[];
}

@Injectable()
export class LearnerKnowledgeService {
  private readonly logger = new Logger(LearnerKnowledgeService.name);

  constructor(
    private readonly flashcardsService: FlashcardsService,
    private readonly hobbyTagsService: HobbyTagsService,
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

    // Fetch data from various sources concurrently
    const [flashcards, vocabulary, lessons, momentsCounts] = await Promise.all([
      this.flashcardsService
        .getFlashcards(userId, undefined, 50)
        .catch(() => []),
      this.hobbyTagsService.getUserVocabulary(userId, language).catch(() => []),
      this.lessonsService.listLessons().catch(() => []),
      this.momentsService
        .getLifetimeCounts(userId)
        .catch(() => ({ moments: 0, corrections: 0, translations: 0 })),
    ]);

    const globalKnowledgeItems = new Map<string, KnowledgeItem>();
    const languageKnowledgeItems = new Map<string, KnowledgeItem>();

    // Process flashcards to populate knowledge items
    (flashcards as Flashcard[]).forEach((f) => {
      let status: KnowledgeItem['status'] = 'new';
      if (f.repetitions > 5 && (f.srs_level || 0) > 3) {
        status = 'known';
      } else if (f.repetitions > 0 && f.easiness_factor < 2.0) {
        status = 'struggling';
      } else if (f.repetitions > 0) {
        status = 'learning';
      }

      globalKnowledgeItems.set(`vocab:${f.word_token}`, {
        id: `vocab:${f.word_token}`,
        type: 'vocabulary',
        status,
        confidenceScore: f.easiness_factor,
        errorFrequency: status === 'struggling' ? 0.5 : 0,
        sourceIds: { flashcardId: f.id },
        lastEncounteredAt: new Date(f.next_review_at),
      });
    });

    // Extract recent encounters from lessons
    const recentEncounters: RecentEncounter[] = lessons
      .slice(0, 5)
      .map((l: LessonRecord) => ({
        topic: l.title || 'Unknown Topic',
        source: 'lesson',
        timestamp: new Date(l.created_at || Date.now()),
      }));

    // Process vocabulary from hobby tags
    if (Array.isArray(vocabulary)) {
      vocabulary.forEach((v: VocabularyResultItem) => {
        const id = `vocab:${v.word}`;
        if (!languageKnowledgeItems.has(id)) {
          languageKnowledgeItems.set(id, {
            id,
            type: 'vocabulary',
            status: 'new',
            confidenceScore: 0,
            errorFrequency: 0,
            sourceIds: {},
            lastEncounteredAt: new Date(),
          });
        }
      });
    }

    // Evaluate skills heuristically from counts
    const calculateSkill = (
      base: number,
      bonusCounts: number,
      divisor: number,
    ) => {
      return Math.min(1.0, base + bonusCounts / divisor);
    };

    const baseLevel = 'A1'; // Fallback to validated CEFR default until language-scoped assessment data exists

    // Synthesize the profile
    return {
      userId,
      language,
      globalProficiency: { level: baseLevel },
      globalSkills: {
        speaking: calculateSkill(0.2, momentsCounts.moments, 50),
        listening: calculateSkill(0.2, lessons.length, 20),
        reading: calculateSkill(0.2, momentsCounts.translations, 100),
        writing: calculateSkill(0.2, momentsCounts.moments, 50),
        grammar: calculateSkill(0.2, momentsCounts.corrections, 40),
        vocabulary: calculateSkill(0.2, flashcards.length, 200),
      },
      globalKnowledgeItems,
      languageKnowledgeItems,
      globalRecentEncounters: recentEncounters,
    };
  }
}
