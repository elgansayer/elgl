import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface AssessmentQuestion {
  id: string;
  question_text: string;
  language: string;
  options: { id: string; text: string; points: number }[];
  correct_option_id: string;
  skill_area: string;
  difficulty_level: number;
}

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getQuestions(language: string = 'en'): Promise<AssessmentQuestion[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('assessment_questions' as never)
      .select('*')
      .eq('language', language)
      .order('difficulty_level', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to fetch assessment questions: ${error.message}`,
      );
      return this.getFallbackQuestions();
    }

    if (!data || data.length === 0) {
      return this.getFallbackQuestions();
    }

    return data as unknown as AssessmentQuestion[];
  }

  private getFallbackQuestions(): AssessmentQuestion[] {
    return [
      {
        id: 'q1',
        question_text:
          'How well can you introduce yourself and answer basic questions about your personal details?',
        language: 'en',
        options: [
          { id: 'o1', text: 'I struggle to understand and reply.', points: 1 },
          {
            id: 'o2',
            text: 'I can do it with simple phrases if the other person speaks slowly.',
            points: 2,
          },
          { id: 'o3', text: 'I can do it easily and confidently.', points: 3 },
        ],
        correct_option_id: 'o3',
        skill_area: 'speaking',
        difficulty_level: 1,
      },
      {
        id: 'q2',
        question_text:
          'Can you understand the main points of clear standard input on familiar matters regularly encountered in work, school, leisure, etc.?',
        language: 'en',
        options: [
          {
            id: 'o1',
            text: 'No, I need translation for most things.',
            points: 1,
          },
          {
            id: 'o2',
            text: 'Yes, if the topic is very familiar to me.',
            points: 2,
          },
          {
            id: 'o3',
            text: 'Yes, I understand almost everything clearly.',
            points: 3,
          },
        ],
        correct_option_id: 'o3',
        skill_area: 'listening',
        difficulty_level: 2,
      },
      {
        id: 'q3',
        question_text:
          'How comfortable are you expressing your opinions and providing explanations for your plans?',
        language: 'en',
        options: [
          { id: 'o1', text: 'I cannot do this yet.', points: 1 },
          {
            id: 'o2',
            text: 'I can give brief reasons and explanations.',
            points: 2,
          },
          {
            id: 'o3',
            text: 'I can express myself fluently and spontaneously.',
            points: 3,
          },
        ],
        correct_option_id: 'o3',
        skill_area: 'speaking',
        difficulty_level: 3,
      },
    ];
  }
}
