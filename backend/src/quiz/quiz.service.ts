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

<<<<<<< HEAD
export interface EvaluateResultsOutput {
  totalScore: number;
  maxScore: number;
  percentage: number;
  suggestedCefr: string;
  description: string;
  skillBreakdown: Record<string, { score: number; maxScore: number }>;
}

=======
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

>>>>>>> origin/main
@Injectable()
export class QuizService {
  private readonly questions: QuizQuestion[] = [
    {
      id: 'q1',
      text: 'How well can you introduce yourself and answer basic questions about your personal details?',
<<<<<<< HEAD
      skill: 'speaking',
      category: 'cefr-a',
=======
      skill: SKILL_MAP['q1'],
      category: CATEGORY_MAP['q1'],
>>>>>>> origin/main
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
<<<<<<< HEAD
      skill: 'listening',
      category: 'cefr-a',
=======
      skill: SKILL_MAP['q2'],
      category: CATEGORY_MAP['q2'],
>>>>>>> origin/main
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
<<<<<<< HEAD
      skill: 'speaking',
      category: 'cefr-b',
=======
      skill: SKILL_MAP['q3'],
      category: CATEGORY_MAP['q3'],
>>>>>>> origin/main
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
<<<<<<< HEAD
      skill: 'listening',
      category: 'cefr-b',
=======
      skill: SKILL_MAP['q4'],
      category: CATEGORY_MAP['q4'],
>>>>>>> origin/main
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
<<<<<<< HEAD
      skill: 'writing',
      category: 'cefr-b',
=======
      skill: SKILL_MAP['q5'],
      category: CATEGORY_MAP['q5'],
>>>>>>> origin/main
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
<<<<<<< HEAD
      skill: 'speaking',
      category: 'cefr-c',
=======
      skill: SKILL_MAP['q6'],
      category: CATEGORY_MAP['q6'],
>>>>>>> origin/main
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
<<<<<<< HEAD
      skill: 'reading',
      category: 'cefr-c',
=======
      skill: SKILL_MAP['q7'],
      category: CATEGORY_MAP['q7'],
>>>>>>> origin/main
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
<<<<<<< HEAD
      skill: 'grammar',
      category: 'cefr-b',
=======
      skill: SKILL_MAP['q8'],
      category: CATEGORY_MAP['q8'],
>>>>>>> origin/main
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
<<<<<<< HEAD
      skill: 'vocabulary',
      category: 'cefr-c',
=======
      skill: SKILL_MAP['q9'],
      category: CATEGORY_MAP['q9'],
>>>>>>> origin/main
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
<<<<<<< HEAD
      skill: 'writing',
      category: 'cefr-c',
=======
      skill: SKILL_MAP['q10'],
      category: CATEGORY_MAP['q10'],
>>>>>>> origin/main
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

  private readonly cefrLevels = [
    { threshold: 0, level: 'A1', description: 'Beginner - you understand and use familiar everyday expressions and very basic phrases.' },
    { threshold: 25, level: 'A2', description: 'Elementary - you can communicate in simple and routine tasks on familiar topics.' },
    { threshold: 40, level: 'B1', description: 'Intermediate - you can deal with most situations likely to arise whilst travelling.' },
    { threshold: 55, level: 'B2', description: 'Upper Intermediate - you can interact with a degree of fluency and spontaneity.' },
    { threshold: 75, level: 'C1', description: 'Advanced - you can express ideas fluently and spontaneously without much searching.' },
    { threshold: 90, level: 'C2', description: 'Proficient - you can summarise information and reconstruct arguments coherently.' },
  ];

  private readonly skillMap: Record<string, string[]> = {
    q1: ['speaking'],
    q2: ['listening'],
    q3: ['speaking'],
    q4: ['listening'],
    q5: ['writing'],
    q6: ['speaking'],
    q7: ['reading'],
    q8: ['grammar'],
    q9: ['vocabulary'],
    q10: ['writing'],
  };

  getQuestions(_language: string): QuizQuestion[] {
    return this.questions;
  }

<<<<<<< HEAD
  evaluateResults(_language: string, answers: Record<string, number>): EvaluateResultsOutput {
    const maxScorePerQuestion = 4;
    const maxScore = this.questions.length * maxScorePerQuestion;
    const totalScore = Object.values(answers).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    let suggestedCefr = this.cefrLevels[0].level;
    let description = this.cefrLevels[0].description;
    for (const cefr of this.cefrLevels) {
      if (percentage >= cefr.threshold) {
        suggestedCefr = cefr.level;
        description = cefr.description;
      }
    }

    const skillBreakdown: Record<string, { score: number; maxScore: number }> = {};
    for (const [qId, pointValue] of Object.entries(answers)) {
      const skills = this.skillMap[qId];
      if (!skills) continue;
      const val = typeof pointValue === 'number' ? pointValue : 0;
      for (const skill of skills) {
        if (!skillBreakdown[skill]) {
          skillBreakdown[skill] = { score: 0, maxScore: 0 };
        }
        skillBreakdown[skill].score += val;
        skillBreakdown[skill].maxScore += maxScorePerQuestion;
=======
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
>>>>>>> origin/main
      }
    }

    return {
      totalScore,
      maxScore,
      percentage,
<<<<<<< HEAD
      suggestedCefr,
      description,
      skillBreakdown,
    };
  }

  submitResults(_results: QuizResults): { received: boolean } {
=======
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
>>>>>>> origin/main
    return { received: true };
  }
}
