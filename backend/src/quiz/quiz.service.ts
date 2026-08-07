import { Injectable } from '@nestjs/common';

export interface QuizQuestion {
  id: string;
  text: string;
  skill: string;
  category: string;
  options: { id: string; text: string; points: number }[];
}

export interface QuizResults {
  score: number;
  maxScore: number;
  suggestedLevel: string;
  answers: Record<string, number>;
}

export interface EvaluateResultsOutput {
  totalScore: number;
  maxScore: number;
  percentage: number;
  suggestedCefr: string;
  description: string;
  skillBreakdown: Record<string, { score: number; maxScore: number }>;
}

@Injectable()
export class QuizService {
  private readonly questions: QuizQuestion[] = [
    {
      id: 'q1',
      text: 'How well can you introduce yourself and answer basic questions about your personal details?',
      skill: 'speaking',
      category: 'cefr-a',
      options: [
        { id: 'o1', text: 'I struggle to understand and reply.', points: 1 },
        {
          id: 'o2',
          text: 'I can do it with simple phrases if the other person speaks slowly.',
          points: 2,
        },
        { id: 'o3', text: 'I can do it easily and confidently.', points: 3 },
      ],
    },
    {
      id: 'q2',
      text: 'Can you understand the main points of clear standard input on familiar matters?',
      skill: 'listening',
      category: 'cefr-a',
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
    },
    {
      id: 'q3',
      text: 'How comfortable are you expressing your opinions and providing explanations for your plans?',
      skill: 'speaking',
      category: 'cefr-b',
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
    },
    {
      id: 'q4',
      text: 'How well do you understand extended speech and lectures, even on complex topics?',
      skill: 'listening',
      category: 'cefr-b',
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
      ],
    },
    {
      id: 'q5',
      text: 'How confident are you writing clear, detailed text on a wide range of subjects?',
      skill: 'writing',
      category: 'cefr-b',
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
      ],
    },
    {
      id: 'q6',
      text: 'How naturally can you interact in a conversation with native speakers?',
      skill: 'speaking',
      category: 'cefr-c',
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
      ],
    },
    {
      id: 'q7',
      text: 'How well can you read and understand authentic texts (articles, reports, literature)?',
      skill: 'reading',
      category: 'cefr-c',
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
      ],
    },
    {
      id: 'q8',
      text: 'How accurately can you use grammar structures when speaking or writing?',
      skill: 'grammar',
      category: 'cefr-b',
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
      ],
    },
    {
      id: 'q9',
      text: 'How wide is your vocabulary range in real-world situations?',
      skill: 'vocabulary',
      category: 'cefr-c',
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
      ],
    },
    {
      id: 'q10',
      text: 'How well can you summarise information from different spoken and written sources?',
      skill: 'writing',
      category: 'cefr-c',
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
      }
    }

    return {
      totalScore,
      maxScore,
      percentage,
      suggestedCefr,
      description,
      skillBreakdown,
    };
  }

  submitResults(_results: QuizResults): { received: boolean } {
    return { received: true };
  }
}
