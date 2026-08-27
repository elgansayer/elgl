import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface AssessmentOption {
  id: string;
  text: string;
  points: number;
}

export type AssessmentSkill =
  'speaking' | 'listening' | 'reading' | 'writing' | 'grammar' | 'vocabulary';
export type AssessmentCategory =
  'self_assessment' | 'comprehension' | 'production' | 'interaction';

export interface AssessmentQuestion {
  id: string;
  question_text: string;
  language: string;
  options: AssessmentOption[];
  correct_option_id: string;
  skill_area: AssessmentSkill;
  category: AssessmentCategory;
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

    return data;
  }

  private getFallbackQuestions(): AssessmentQuestion[] {
    return [
      {
        id: 'q1',
        question_text:
          'How well can you introduce yourself and answer basic questions about your personal details (name, age, where you live)?',
        language: 'en',
        options: [
          {
            id: 'q1_a',
            text: 'I struggle to understand or reply, even with help.',
            points: 1,
          },
          {
            id: 'q1_b',
            text: 'I can manage with simple, memorised phrases if the other person speaks slowly and clearly.',
            points: 2,
          },
          {
            id: 'q1_c',
            text: 'I can introduce myself and answer basic questions with some hesitation.',
            points: 3,
          },
          {
            id: 'q1_d',
            text: 'I can do this easily, confidently, and naturally.',
            points: 4,
          },
        ],
        correct_option_id: 'q1_d',
        skill_area: 'speaking',
        category: 'self_assessment',
        difficulty_level: 1,
      },
      {
        id: 'q2',
        question_text:
          'Can you understand the main points of clear, standard speech on familiar matters (work, school, leisure, travel)?',
        language: 'en',
        options: [
          {
            id: 'q2_a',
            text: 'No, I need translations or subtitles for nearly everything.',
            points: 1,
          },
          {
            id: 'q2_b',
            text: 'I can catch a few familiar words and phrases but often lose the thread.',
            points: 2,
          },
          {
            id: 'q2_c',
            text: 'Yes, I understand the main ideas when the topic is familiar and the speaker is clear.',
            points: 3,
          },
          {
            id: 'q2_d',
            text: 'Yes, I understand almost everything, including nuanced discussions and different accents.',
            points: 4,
          },
        ],
        correct_option_id: 'q2_d',
        skill_area: 'listening',
        category: 'comprehension',
        difficulty_level: 2,
      },
      {
        id: 'q3',
        question_text:
          'How comfortable are you expressing opinions, giving reasons, and explaining plans or ambitions?',
        language: 'en',
        options: [
          {
            id: 'q3_a',
            text: 'I cannot do this yet -- I mostly rely on single words or gestures.',
            points: 1,
          },
          {
            id: 'q3_b',
            text: 'I can state my opinion in simple terms using basic connectors (and, but, because).',
            points: 2,
          },
          {
            id: 'q3_c',
            text: 'I can give clear reasons and explanations with reasonable fluency on familiar topics.',
            points: 3,
          },
          {
            id: 'q3_d',
            text: 'I can express myself fluently and spontaneously, structuring arguments precisely.',
            points: 4,
          },
        ],
        correct_option_id: 'q3_d',
        skill_area: 'speaking',
        category: 'production',
        difficulty_level: 3,
      },
      {
        id: 'q4',
        question_text:
          'How well can you read and understand articles, reports, or stories in the target language?',
        language: 'en',
        options: [
          {
            id: 'q4_a',
            text: 'I can only recognise a few words and very short, simple sentences.',
            points: 1,
          },
          {
            id: 'q4_b',
            text: 'I can understand short, simple texts on familiar topics with occasional look-ups.',
            points: 2,
          },
          {
            id: 'q4_c',
            text: "I can read articles and reports on current affairs and grasp the author's viewpoint.",
            points: 3,
          },
          {
            id: 'q4_d',
            text: 'I can read with ease virtually all forms of written language, including abstract and literary texts.',
            points: 4,
          },
        ],
        correct_option_id: 'q4_d',
        skill_area: 'reading',
        category: 'comprehension',
        difficulty_level: 3,
      },
      {
        id: 'q5',
        question_text:
          'How well can you write texts such as messages, emails, essays, or reports?',
        language: 'en',
        options: [
          {
            id: 'q5_a',
            text: 'I can write a few isolated words and very simple phrases (e.g. greetings, filling in forms).',
            points: 1,
          },
          {
            id: 'q5_b',
            text: 'I can write short, simple notes and messages on familiar everyday topics.',
            points: 2,
          },
          {
            id: 'q5_c',
            text: 'I can write clear, detailed text on a range of subjects and explain viewpoints.',
            points: 3,
          },
          {
            id: 'q5_d',
            text: 'I can write complex texts in an appropriate and effective style, with logical structure.',
            points: 4,
          },
        ],
        correct_option_id: 'q5_d',
        skill_area: 'writing',
        category: 'production',
        difficulty_level: 4,
      },
      {
        id: 'q6',
        question_text:
          'In a conversation, how well can you interact and keep the dialogue going?',
        language: 'en',
        options: [
          {
            id: 'q6_a',
            text: 'I can only respond with single words or rehearsed phrases.',
            points: 1,
          },
          {
            id: 'q6_b',
            text: 'I can handle very short social exchanges but cannot sustain a conversation on my own.',
            points: 2,
          },
          {
            id: 'q6_c',
            text: 'I can enter unprepared into conversations on familiar topics and handle everyday situations.',
            points: 3,
          },
          {
            id: 'q6_d',
            text: 'I can interact with ease and spontaneity, taking turns naturally and repairing communication smoothly.',
            points: 4,
          },
        ],
        correct_option_id: 'q6_d',
        skill_area: 'speaking',
        category: 'interaction',
        difficulty_level: 5,
      },
      {
        id: 'q7',
        question_text:
          'How well do you handle grammar -- verb tenses, sentence structure, articles, prepositions?',
        language: 'en',
        options: [
          {
            id: 'q7_a',
            text: 'I make frequent basic errors that often cause misunderstanding.',
            points: 1,
          },
          {
            id: 'q7_b',
            text: 'I use simple structures correctly but still make noticeable errors with complex sentences.',
            points: 2,
          },
          {
            id: 'q7_c',
            text: 'I have good grammatical control with occasional errors that do not cause misunderstanding.',
            points: 3,
          },
          {
            id: 'q7_d',
            text: 'I maintain a high degree of grammatical accuracy; errors are rare and difficult to spot.',
            points: 4,
          },
        ],
        correct_option_id: 'q7_d',
        skill_area: 'grammar',
        category: 'self_assessment',
        difficulty_level: 2,
      },
      {
        id: 'q8',
        question_text:
          'How would you rate your vocabulary range -- can you find the right words for different situations?',
        language: 'en',
        options: [
          {
            id: 'q8_a',
            text: 'I have a very limited vocabulary restricted to immediate personal needs.',
            points: 1,
          },
          {
            id: 'q8_b',
            text: 'I have enough vocabulary for everyday transactions and familiar topics, but often search for words.',
            points: 2,
          },
          {
            id: 'q8_c',
            text: 'I have a good range of vocabulary for most topics and can paraphrase when I lack a specific word.',
            points: 3,
          },
          {
            id: 'q8_d',
            text: 'I have a rich and precise vocabulary, including idiomatic expressions and colloquialisms.',
            points: 4,
          },
        ],
        correct_option_id: 'q8_d',
        skill_area: 'vocabulary',
        category: 'self_assessment',
        difficulty_level: 2,
      },
      {
        id: 'q9',
        question_text:
          'How well can you understand films, TV programmes, podcasts, or radio without subtitles or transcripts?',
        language: 'en',
        options: [
          {
            id: 'q9_a',
            text: 'I can barely follow anything without visual aids or translations.',
            points: 1,
          },
          {
            id: 'q9_b',
            text: 'I can follow the general storyline when the delivery is slow and clear.',
            points: 2,
          },
          {
            id: 'q9_c',
            text: 'I can understand most TV news and current affairs programmes, and the majority of films in standard dialect.',
            points: 3,
          },
          {
            id: 'q9_d',
            text: 'I have no difficulty understanding any kind of spoken language, whether live or broadcast, even at fast native speed.',
            points: 4,
          },
        ],
        correct_option_id: 'q9_d',
        skill_area: 'listening',
        category: 'comprehension',
        difficulty_level: 4,
      },
      {
        id: 'q10',
        question_text:
          'How easily can you recognise implied meaning, humour, sarcasm, and cultural references?',
        language: 'en',
        options: [
          {
            id: 'q10_a',
            text: 'I take everything literally and often miss non-literal meanings entirely.',
            points: 1,
          },
          {
            id: 'q10_b',
            text: 'I can sometimes detect tone (angry, happy) but miss subtle implications.',
            points: 2,
          },
          {
            id: 'q10_c',
            text: 'I can usually recognise irony, humour, and cultural cues in familiar contexts.',
            points: 3,
          },
          {
            id: 'q10_d',
            text: 'I appreciate fine shades of meaning, wordplay, and culture-specific references with ease.',
            points: 4,
          },
        ],
        correct_option_id: 'q10_d',
        skill_area: 'listening',
        category: 'interaction',
        difficulty_level: 5,
      },
    ];
  }
}
