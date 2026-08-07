import { Injectable, Logger } from '@nestjs/common';
import { AssessmentsService, AssessmentQuestion } from '../assessments/assessments.service';

export interface QuizOption {
  id: string;
  text: string;
  points: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  skill: 'reading' | 'writing' | 'speaking' | 'listening' | 'grammar' | 'vocabulary';
  category: 'self_assessment' | 'comprehension' | 'production' | 'interaction';
  options: QuizOption[];
}

export interface QuizResultRequest {
  language: string;
  answers: Record<string, number>;
}

export interface QuizResultResponse {
  totalScore: number;
  maxScore: number;
  percentage: number;
  suggestedCefr: string;
  skillBreakdown: Record<string, { score: number; max: number }>;
  description: string;
}

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(private readonly assessmentsService: AssessmentsService) {}

  private readonly cefrLevels = [
    { level: 'A1', minPct: 0, description: 'Beginner - You can understand and use familiar everyday expressions and very basic phrases.' },
    { level: 'A2', minPct: 20, description: 'Elementary - You can communicate in simple and routine tasks requiring a simple and direct exchange of information.' },
    { level: 'B1', minPct: 40, description: 'Intermediate - You can deal with most situations likely to arise whilst travelling in an area where the language is spoken.' },
    { level: 'B2', minPct: 60, description: 'Upper Intermediate - You can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible.' },
    { level: 'C1', minPct: 80, description: 'Advanced - You can express yourself fluently and spontaneously without much obvious searching for expressions.' },
    { level: 'C2', minPct: 90, description: 'Proficient - You can understand with ease virtually everything heard or read and express yourself spontaneously, very fluently and precisely.' },
  ];

  async getQuestions(language: string): Promise<QuizQuestion[]> {
    try {
      const dbQuestions = await this.assessmentsService.getQuestions(language);
      return dbQuestions.map((q: AssessmentQuestion) => this.mapToQuizQuestion(q));
    } catch (err) {
      this.logger.warn(`Failed to fetch questions from DB, using fallback: ${err}`);
      const fallback = await this.assessmentsService.getQuestions('en');
      return fallback.map((q: AssessmentQuestion) => this.mapToQuizQuestion(q));
    }
  }

  private mapToQuizQuestion(q: AssessmentQuestion): QuizQuestion {
    return {
      id: q.id,
      text: q.question_text,
      skill: q.skill_area,
      category: q.category,
      options: q.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        points: opt.points,
      })),
    };
  }

  async evaluateResults(language: string, answers: Record<string, number>): Promise<QuizResultResponse> {
    const questions = await this.getQuestions(language);
    let totalScore = 0;
    let maxScore = 0;
    const skillScores: Record<string, { score: number; max: number }> = {};

    for (const q of questions) {
      const answerScore = answers[q.id] ?? 0;
      totalScore += answerScore;
      const maxForQuestion = Math.max(...q.options.map((o) => o.points));
      maxScore += maxForQuestion;

      if (!skillScores[q.skill]) {
        skillScores[q.skill] = { score: 0, max: 0 };
      }
      skillScores[q.skill].score += answerScore;
      skillScores[q.skill].max += maxForQuestion;
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    let suggestedCefr = 'A1';
    let description = '';
    for (let i = this.cefrLevels.length - 1; i >= 0; i--) {
      if (percentage >= this.cefrLevels[i].minPct) {
        suggestedCefr = this.cefrLevels[i].level;
        description = this.cefrLevels[i].description;
        break;
      }
    }

    return {
      totalScore,
      maxScore,
      percentage,
      suggestedCefr,
      skillBreakdown: skillScores,
      description,
    };
  }
}
