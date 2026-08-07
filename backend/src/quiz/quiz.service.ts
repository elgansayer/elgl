import { Injectable } from '@nestjs/common';

export interface QuizQuestion {
  id: string;
  text: string;
  skill: string;
  category: string;
  options: { id: string; text: string; points: number }[];
}

export interface QuizResults {
  totalScore: number;
  maxScore: number;
  percentage: number;
  suggestedCefr: string;
  skillBreakdown: Record<
    string,
    { score: number; max: number; percentage: number }
  >;
  description: string;
}

interface EvaluateInput {
  [questionId: string]: number;
}

const CEFR_THRESHOLDS: {
  cefr: string;
  minPercentage: number;
  description: string;
}[] = [
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
    description:
      'Intermediate - You can deal with most travel and familiar topics.',
  },
  {
    cefr: 'B2',
    minPercentage: 60,
    description:
      'Upper Intermediate - You can interact with a degree of fluency.',
  },
  {
    cefr: 'C1',
    minPercentage: 80,
    description:
      'Advanced - You can express yourself fluently and spontaneously.',
  },
  {
    cefr: 'C2',
    minPercentage: 90,
    description:
      'Proficient - You have mastered the language to a near-native level.',
  },
];

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

const CATEGORY_MAP: Record<string, string> = {
  q1: 'self-assessment',
  q2: 'comprehension',
  q3: 'expression',
  q4: 'comprehension',
  q5: 'production',
  q6: 'interaction',
  q7: 'comprehension',
  q8: 'accuracy',
  q9: 'range',
  q10: 'production',
};

@Injectable()
export class QuizService {
  private readonly questions: QuizQuestion[] = [
    {
      id: 'q1',
      text: 'How well can you introduce yourself and answer basic questions about your personal details?',
      skill: SKILL_MAP['q1'],
      category: CATEGORY_MAP['q1'],
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
          text: 'I can do it fluently and naturally, adapting to context.',
          points: 4,
        },
      ],
    },
    {
      id: 'q2',
      text: 'Can you understand the main points of clear standard input on familiar matters?',
      skill: SKILL_MAP['q2'],
      category: CATEGORY_MAP['q2'],
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
          text: 'Yes, I understand complex and nuanced content effortlessly.',
          points: 4,
        },
      ],
    },
    {
      id: 'q3',
      text: 'How comfortable are you expressing your opinions and providing explanations for your plans?',
      skill: SKILL_MAP['q3'],
      category: CATEGORY_MAP['q3'],
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
          text: 'I can present complex arguments with precision and nuance.',
          points: 4,
        },
      ],
    },
    {
      id: 'q4',
      text: 'How well do you understand extended speech and lectures, even on complex topics?',
      skill: SKILL_MAP['q4'],
      category: CATEGORY_MAP['q4'],
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
          text: 'I understand all nuances, accents, and implied meanings.',
          points: 4,
        },
      ],
    },
    {
      id: 'q5',
      text: 'How confident are you writing clear, detailed text on a wide range of subjects?',
      skill: SKILL_MAP['q5'],
      category: CATEGORY_MAP['q5'],
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
          text: 'I can write sophisticated, stylistically appropriate texts.',
          points: 4,
        },
      ],
    },
    {
      id: 'q6',
      text: 'How naturally can you interact in a conversation with native speakers?',
      skill: SKILL_MAP['q6'],
      category: CATEGORY_MAP['q6'],
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
          text: 'I participate effortlessly in any conversation, including specialised ones.',
          points: 4,
        },
      ],
    },
    {
      id: 'q7',
      text: 'How well can you read and understand authentic texts (articles, reports, literature)?',
      skill: SKILL_MAP['q7'],
      category: CATEGORY_MAP['q7'],
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
          text: 'I read and critically analyse any text with full comprehension.',
          points: 4,
        },
      ],
    },
    {
      id: 'q8',
      text: 'How accurately can you use grammar structures when speaking or writing?',
      skill: SKILL_MAP['q8'],
      category: CATEGORY_MAP['q8'],
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
          text: 'I use grammar flawlessly, including subtle and idiomatic structures.',
          points: 4,
        },
      ],
    },
    {
      id: 'q9',
      text: 'How wide is your vocabulary range in real-world situations?',
      skill: SKILL_MAP['q9'],
      category: CATEGORY_MAP['q9'],
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
          text: 'I have an extensive vocabulary and use language with precision and creativity.',
          points: 4,
        },
      ],
    },
    {
      id: 'q10',
      text: 'How well can you summarise information from different spoken and written sources?',
      skill: SKILL_MAP['q10'],
      category: CATEGORY_MAP['q10'],
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
          text: 'I can synthesise information from diverse sources into coherent, original summaries.',
          points: 4,
        },
      ],
    },
  ];

  getQuestions(_language: string): QuizQuestion[] {
    return this.questions;
  }

  evaluateResults(_language: string, answers: EvaluateInput): QuizResults {
    const questionMap = new Map(this.questions.map((q) => [q.id, q]));
    let totalScore = 0;
    const maxScore = this.questions.length * 4;

    const skillScores: Record<string, { score: number; max: number }> = {};

    for (const [questionId, points] of Object.entries(answers)) {
      const question = questionMap.get(questionId);
      if (!question) continue;

      totalScore += points;

      const skill = question.skill;
      if (!skillScores[skill]) {
        skillScores[skill] = { score: 0, max: 0 };
      }
      skillScores[skill].score += points;
      skillScores[skill].max += 4;
    }

    const percentage = Math.round((totalScore / maxScore) * 100);

    const cefrEntry =
      CEFR_THRESHOLDS.slice()
        .reverse()
        .find((t) => percentage >= t.minPercentage) ?? CEFR_THRESHOLDS[0];

    const skillBreakdown: Record<
      string,
      { score: number; max: number; percentage: number }
    > = {};
    for (const [skill, scores] of Object.entries(skillScores)) {
      skillBreakdown[skill] = {
        score: scores.score,
        max: scores.max,
        percentage: Math.round((scores.score / scores.max) * 100),
      };
    }

    const expectedSkills = [
      'speaking',
      'reading',
      'writing',
      'listening',
      'grammar',
      'vocabulary',
    ];
    for (const skill of expectedSkills) {
      if (!skillBreakdown[skill]) {
        skillBreakdown[skill] = { score: 0, max: 0, percentage: 0 };
      }
    }

    return {
      totalScore,
      maxScore,
      percentage,
      suggestedCefr: cefrEntry.cefr,
      skillBreakdown,
      description: cefrEntry.description,
    };
  }

  submitResults(_results: {
    score: number;
    maxScore: number;
    suggestedLevel: string;
    answers: Record<string, number>;
  }): { received: boolean } {
    return { received: true };
  }
}
