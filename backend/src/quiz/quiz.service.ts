import { Injectable } from '@nestjs/common';

export interface QuizQuestion {
  id: string;
  text: string;
  skill: string;
  category: string;
  options: { id: string; text: string; points: number }[];
}

export interface QuizResults {
  answers: Record<string, number>;
}

export interface EvaluationResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  suggestedCefr: string;
  skillBreakdown: Record<string, number>;
  description: string;
}

const SKILL_MAP: Record<string, string> = {
  q1: 'speaking',
  q2: 'listening',
  q3: 'speaking',
  q4: 'listening',
  q5: 'writing',
  q6: 'speaking',
  q7: 'reading',
  q8: 'grammar',
  q9: 'vocabulary',
  q10: 'writing',
};

const CEFR_THRESHOLDS: { min: number; level: string; description: string }[] = [
  {
    min: 0,
    level: 'A1',
    description:
      'Beginner: Can understand and use familiar everyday expressions and very basic phrases.',
  },
  {
    min: 25,
    level: 'A2',
    description:
      'Elementary: Can communicate in simple and routine tasks on familiar topics.',
  },
  {
    min: 50,
    level: 'B1',
    description:
      'Intermediate: Can deal with most situations likely to arise while travelling.',
  },
  {
    min: 70,
    level: 'B2',
    description:
      'Upper Intermediate: Can interact with a degree of fluency and spontaneity.',
  },
  {
    min: 85,
    level: 'C1',
    description:
      'Advanced: Can use language flexibly and effectively for social, academic and professional purposes.',
  },
  {
    min: 95,
    level: 'C2',
    description:
      'Proficient: Can understand with ease virtually everything heard or read.',
  },
];

const MAX_POINTS_PER_QUESTION = 4;

@Injectable()
export class QuizService {
  private readonly questions: QuizQuestion[] = [
    {
      id: 'q1',
      skill: 'speaking',
      category: 'introduction',
      text: 'How well can you introduce yourself and answer basic questions about your personal details?',
      options: [
        { id: 'o1', text: 'I struggle to understand and reply.', points: 1 },
        {
          id: 'o2',
          text: 'I can do it with simple phrases if the other person speaks slowly.',
          points: 2,
        },
        { id: 'o3', text: 'I can do it easily and confidently.', points: 3 },
        {
          id: 'o4',
          text: 'I can introduce myself, describe my background and discuss current events in detail.',
          points: 4,
        },
      ],
    },
    {
      id: 'q2',
      skill: 'listening',
      category: 'comprehension',
      text: 'Can you understand the main points of clear standard input on familiar matters?',
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
        {
          id: 'o4',
          text: 'I can effortlessly understand any kind of spoken language, whether live or broadcast.',
          points: 4,
        },
      ],
    },
    {
      id: 'q3',
      skill: 'speaking',
      category: 'expression',
      text: 'How comfortable are you expressing your opinions and providing explanations for your plans?',
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
        {
          id: 'o4',
          text: 'I can present clear, smoothly flowing descriptions or arguments in a style appropriate to the context.',
          points: 4,
        },
      ],
    },
    {
      id: 'q4',
      skill: 'listening',
      category: 'listening',
      text: 'How well do you understand extended speech and lectures, even on complex topics?',
      options: [
        {
          id: 'o1',
          text: 'I can only follow if spoken slowly and clearly.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I understand most of the main ideas even on unfamiliar topics.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I understand complex arguments and nuanced meanings easily.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I can follow specialised lectures and presentations that use colloquialisms, regional usage, or unfamiliar terminology.',
          points: 4,
        },
      ],
    },
    {
      id: 'q5',
      skill: 'writing',
      category: 'writing',
      text: 'How confident are you writing clear, detailed text on a wide range of subjects?',
      options: [
        {
          id: 'o1',
          text: 'I can only write simple isolated phrases and sentences.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I can write connected text on familiar topics with reasonable clarity.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I can write well-structured text expressing nuanced points of view.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I can write complex letters, reports or articles that present a case with an effective logical structure.',
          points: 4,
        },
      ],
    },
    {
      id: 'q6',
      skill: 'speaking',
      category: 'conversation',
      text: 'How naturally can you interact in a conversation with native speakers?',
      options: [
        {
          id: 'o1',
          text: 'I struggle to keep up and need them to adapt for me.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I can handle most situations with some pauses to think.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I interact fluently and spontaneously without strain for either party.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I can take part effortlessly in any conversation and can express myself with precision even in complex or sensitive discussions.',
          points: 4,
        },
      ],
    },
    {
      id: 'q7',
      skill: 'reading',
      category: 'reading',
      text: 'How well can you read and understand authentic texts (articles, reports, literature)?',
      options: [
        {
          id: 'o1',
          text: 'I can only understand very short, simple texts.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I understand contemporary prose and articles with occasional dictionary use.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I read complex literary and technical texts with ease.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I can critically interpret virtually all forms of the written language.',
          points: 4,
        },
      ],
    },
    {
      id: 'q8',
      skill: 'grammar',
      category: 'grammar',
      text: 'How accurately can you use grammar structures when speaking or writing?',
      options: [
        {
          id: 'o1',
          text: 'I make frequent basic errors that sometimes cause misunderstanding.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I am generally accurate with occasional errors that do not cause misunderstanding.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I use grammar accurately and appropriately, even in complex structures.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I maintain consistent grammatical control of complex language.',
          points: 4,
        },
      ],
    },
    {
      id: 'q9',
      skill: 'vocabulary',
      category: 'vocabulary',
      text: 'How wide is your vocabulary range in real-world situations?',
      options: [
        {
          id: 'o1',
          text: 'I rely on a limited set of basic words and phrases.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I have enough vocabulary to express myself on most everyday topics.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I have a broad vocabulary and can use idiomatic expressions naturally.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I have a good command of a very broad lexical repertoire.',
          points: 4,
        },
      ],
    },
    {
      id: 'q10',
      skill: 'writing',
      category: 'synthesis',
      text: 'How well can you summarise information from different spoken and written sources?',
      options: [
        {
          id: 'o1',
          text: 'I find summarising very difficult and miss key points.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I can summarise the main points from simple sources.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I can reconstruct arguments and accounts coherently from multiple sources.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I can summarise information from different spoken and written sources, reconstructing arguments and accounts in a coherent presentation.',
          points: 4,
        },
      ],
    },
  ];

  getQuestions(_language: string): QuizQuestion[] {
    return this.questions;
  }

  evaluateResults(
    _language: string,
    answers: Record<string, number>,
  ): EvaluationResult {
    let totalScore = 0;
    const skillBreakdown: Record<string, number> = {};

    for (const q of this.questions) {
      const answer = answers[q.id] ?? 0;
      totalScore += answer;
      const skill = SKILL_MAP[q.id] ?? 'unknown';
      skillBreakdown[skill] = (skillBreakdown[skill] ?? 0) + answer;
    }

    const maxScore = this.questions.length * MAX_POINTS_PER_QUESTION;
    const percentage = Math.round((totalScore / maxScore) * 100);

    const cefr =
      [...CEFR_THRESHOLDS].reverse().find((t) => percentage >= t.min) ??
      CEFR_THRESHOLDS[0];

    return {
      totalScore,
      maxScore,
      percentage,
      suggestedCefr: cefr.level,
      description: cefr.description,
      skillBreakdown,
    };
  }

  submitResults(_results: QuizResults): { received: boolean } {
    return { received: true };
  }
}
