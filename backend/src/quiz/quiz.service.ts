import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SubmitQuizDto } from './dto/quiz.dto';

interface QuizOption {
  id: string;
  text: string;
  points: number;
}

interface InternalQuizQuestion {
  id: string;
  text: string;
  skill: string;
  category: string;
  options: QuizOption[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  skill: string;
  category: string;
  options: { id: string; text: string }[];
}

export interface QuizResults {
  score: number;
  maxScore: number;
  percentage: number;
  suggestedCefr: string;
  skillBreakdown: Record<
    string,
    { score: number; max: number; percentage: number }
  >;
  description: string;
}

interface AssessmentRow {
  id: string;
  question_text: string;
  language: string;
  options: unknown;
  skill_area: string;
  category: string;
  difficulty_level: number;
}

const CEFR_THRESHOLDS = [
  {
    cefr: 'A1',
    minPercentage: 0,
    description: 'Beginner - You are just starting your language journey.',
  },
  {
    cefr: 'A2',
    minPercentage: 20,
    description: 'Elementary - You can handle basic everyday situations.',
  },
  {
    cefr: 'B1',
    minPercentage: 40,
    description: 'Intermediate - You can deal with most travel and familiar topics.',
  },
  {
    cefr: 'B2',
    minPercentage: 60,
    description: 'Upper Intermediate - You can interact with a degree of fluency.',
  },
  {
    cefr: 'C1',
    minPercentage: 80,
    description: 'Advanced - You can express yourself fluently and spontaneously.',
  },
  {
    cefr: 'C2',
    minPercentage: 90,
    description: 'Proficient - You have mastered the language to a near-native level.',
  },
] as const;

const EXPECTED_SKILLS = [
  'speaking',
  'reading',
  'writing',
  'listening',
  'grammar',
  'vocabulary',
] as const;

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getQuestions(language = 'en'): Promise<QuizQuestion[]> {
    const questions = await this.loadQuestions(language);
    return questions.map((question) => ({
      id: question.id,
      text: question.text,
      skill: question.skill,
      category: question.category,
      options: question.options.map(({ id, text }) => ({ id, text })),
    }));
  }

  async submitResults(
    userId: string,
    submission: SubmitQuizDto,
  ): Promise<QuizResults> {
    const answerEntries = Object.entries(submission.answers ?? {});
    if (answerEntries.length === 0 || answerEntries.length > 30) {
      throw new BadRequestException('A complete diagnostic answer set is required');
    }

    const questions = await this.loadQuestions(submission.targetLanguage);
    if (questions.length === 0) {
      throw new ServiceUnavailableException(
        'Diagnostic questions are not available right now',
      );
    }

    const result = this.evaluateResults(questions, submission.answers);
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ proficiency_level: result.suggestedCefr } as never)
      .eq('id', userId);

    if (error) {
      this.logger.error('Failed to persist diagnostic quiz result');
      throw new ServiceUnavailableException(
        'Your diagnostic result could not be saved. Please retry.',
      );
    }

    return result;
  }

  evaluateResults(
    questions: InternalQuizQuestion[],
    answers: Record<string, string>,
  ): QuizResults {
    if (questions.length === 0) {
      throw new BadRequestException('No diagnostic questions were supplied');
    }

    const questionIds = new Set(questions.map((question) => question.id));
    const answerIds = Object.keys(answers);
    if (
      answerIds.length !== questions.length ||
      answerIds.some((id) => !questionIds.has(id))
    ) {
      throw new BadRequestException('Every diagnostic question must be answered once');
    }

    let score = 0;
    let maxScore = 0;
    const skillScores: Record<string, { score: number; max: number }> = {};

    for (const question of questions) {
      const selectedOptionId = answers[question.id];
      if (
        typeof selectedOptionId !== 'string' ||
        selectedOptionId.length === 0 ||
        selectedOptionId.length > 64
      ) {
        throw new BadRequestException('A diagnostic answer is invalid');
      }

      const selected = question.options.find(
        (option) => option.id === selectedOptionId,
      );
      if (!selected) {
        throw new BadRequestException('A diagnostic answer is invalid');
      }

      const questionMax = Math.max(...question.options.map((option) => option.points));
      score += selected.points;
      maxScore += questionMax;

      const skill = question.skill || 'general';
      skillScores[skill] ??= { score: 0, max: 0 };
      skillScores[skill].score += selected.points;
      skillScores[skill].max += questionMax;
    }

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const threshold = [...CEFR_THRESHOLDS]
      .reverse()
      .find((entry) => percentage >= entry.minPercentage) ?? CEFR_THRESHOLDS[0];

    const skillBreakdown: QuizResults['skillBreakdown'] = {};
    for (const [skill, values] of Object.entries(skillScores)) {
      skillBreakdown[skill] = {
        score: values.score,
        max: values.max,
        percentage:
          values.max > 0 ? Math.round((values.score / values.max) * 100) : 0,
      };
    }
    for (const skill of EXPECTED_SKILLS) {
      skillBreakdown[skill] ??= { score: 0, max: 0, percentage: 0 };
    }

    return {
      score,
      maxScore,
      percentage,
      suggestedCefr: threshold.cefr,
      skillBreakdown,
      description: threshold.description,
    };
  }

  private async loadQuestions(language: string): Promise<InternalQuizQuestion[]> {
    const requested = await this.fetchRows(language);
    const rows = requested.length > 0 || language === 'en' ? requested : await this.fetchRows('en');

    if (rows.length === 0) return [];

    const questions = rows.map((row) => this.mapRow(row));
    if (questions.some((question) => question === null)) {
      this.logger.error('Diagnostic question configuration is invalid');
      throw new ServiceUnavailableException(
        'Diagnostic questions are not available right now',
      );
    }

    return questions as InternalQuizQuestion[];
  }

  private async fetchRows(language: string): Promise<AssessmentRow[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('assessment_questions' as never)
      .select('id, question_text, language, options, skill_area, category, difficulty_level')
      .eq('language', language)
      .order('difficulty_level', { ascending: true })
      .limit(20);

    if (error) {
      this.logger.error('Failed to load diagnostic question bank');
      throw new ServiceUnavailableException(
        'Diagnostic questions are not available right now',
      );
    }

    return Array.isArray(data) ? (data as AssessmentRow[]) : [];
  }

  private mapRow(row: AssessmentRow): InternalQuizQuestion | null {
    if (
      typeof row.id !== 'string' ||
      typeof row.question_text !== 'string' ||
      row.question_text.trim().length === 0 ||
      row.question_text.length > 1000 ||
      !Array.isArray(row.options) ||
      row.options.length < 2 ||
      row.options.length > 8
    ) {
      return null;
    }

    const options: QuizOption[] = [];
    for (const rawOption of row.options) {
      if (!rawOption || typeof rawOption !== 'object') return null;
      const option = rawOption as Record<string, unknown>;
      if (
        typeof option.id !== 'string' ||
        option.id.length === 0 ||
        option.id.length > 64 ||
        typeof option.text !== 'string' ||
        option.text.trim().length === 0 ||
        option.text.length > 1000 ||
        typeof option.points !== 'number' ||
        !Number.isFinite(option.points) ||
        option.points < 0 ||
        option.points > 100
      ) {
        return null;
      }
      options.push({ id: option.id, text: option.text, points: option.points });
    }

    return {
      id: row.id,
      text: row.question_text,
      skill: row.skill_area || 'general',
      category: row.category || 'general',
      options,
    };
  }
}
