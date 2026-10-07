import { Injectable, Logger } from '@nestjs/common';
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

    // Fetch data from various sources (Mock implementation for now based on design doc)
    const [flashcards, vocabulary, assessments, lessons, momentsCounts] =
      await Promise.all([
        this.flashcardsService
          .getFlashcards(userId, undefined, 20)
          .catch(() => []),
        this.hobbyTagsService
          .getUserVocabulary(userId, language)
          .catch(() => []),
        this.assessmentsService.getQuestions(language).catch(() => []), // Placeholder
        this.lessonsService.listLessons().catch(() => []), // Placeholder
        this.momentsService
          .getLifetimeCounts(userId)
          .catch(() => ({ moments: 0, corrections: 0, translations: 0 })),
      ]);

    const knowledgeItems = new Map<string, KnowledgeItem>();

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

      knowledgeItems.set(`vocab:${f.word_token}`, {
        id: `vocab:${f.word_token}`,
        type: 'vocabulary',
        status,
        confidenceScore: f.easiness_factor,
        errorFrequency: status === 'struggling' ? 0.5 : 0, // Mocked
        sourceIds: { flashcardId: f.id },
        lastEncounteredAt: new Date(f.next_review_at), // Using next_review_at as a proxy for last encountered
      });
    });

    // Extract recent encounters from lessons (mock logic)
    const recentEncounters: RecentEncounter[] = lessons
      .slice(0, 3)
      .map((l: any) => ({
        topic: l.title || 'Unknown Topic',
        source: 'lesson',
        timestamp: new Date(l.created_at || Date.now()),
      }));

    // Synthesize the profile
    return {
      userId,
      language,
      overallProficiency: { level: 'B1' }, // Placeholder based on assessments
      skills: {
        speaking: 0.5,
        listening: 0.6,
        reading: 0.7,
        writing: 0.4,
        grammar: 0.5,
        vocabulary: 0.6, // Adjusted based on moments/corrections maybe
      },
      knowledgeItems,
      recentEncounters,
    };
  }
}
