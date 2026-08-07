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

@Injectable()
export class QuizService {
  private readonly questions: QuizQuestion[] = [
    {
      id: 'q1',
      text: 'How well can you introduce yourself and answer basic questions about your personal details?',
      skill: 'speaking',
      category: 'speaking',
      options: [
        { id: 'o1', text: 'I struggle to understand and reply.', points: 1 },
        { id: 'o2', text: 'I can do it with simple phrases if the other person speaks slowly.', points: 2 },
        { id: 'o3', text: 'I can do it easily and confidently.', points: 3 },
        { id: 'o4', text: 'I can speak extensively on any topic with native fluency.', points: 4 },
      ],
    },
    {
      id: 'q2',
      text: 'Can you understand the main points of clear standard input on familiar matters?',
      skill: 'listening',
      category: 'listening',
      options: [
        { id: 'o1', text: 'No, I need translation for most things.', points: 1 },
        { id: 'o2', text: 'Yes, if the topic is very familiar to me.', points: 2 },
        { id: 'o3', text: 'Yes, I understand almost everything clearly.', points: 3 },
        { id: 'o4', text: 'I understand native-level speech effortlessly.', points: 4 },
      ],
    },
    {
      id: 'q3',
      text: 'How comfortable are you expressing your opinions and providing explanations for your plans?',
      skill: 'writing',
      category: 'writing',
      options: [
        { id: 'o1', text: 'I cannot do this yet.', points: 1 },
        { id: 'o2', text: 'I can give brief reasons and explanations.', points: 2 },
        { id: 'o3', text: 'I can express myself fluently and spontaneously.', points: 3 },
        { id: 'o4', text: 'I can craft persuasive arguments with nuanced reasoning.', points: 4 },
      ],
    },
    {
      id: 'q4',
      text: 'How well do you understand extended speech and lectures, even on complex topics?',
      skill: 'listening',
      category: 'listening',
      options: [
        { id: 'o1', text: 'I can only follow if spoken slowly and clearly.', points: 1 },
        { id: 'o2', text: 'I understand most of the main ideas even on unfamiliar topics.', points: 2 },
        { id: 'o3', text: 'I understand complex arguments and nuanced meanings easily.', points: 3 },
        { id: 'o4', text: 'I can follow any lecture or debate without difficulty.', points: 4 },
      ],
    },
    {
      id: 'q5',
      text: 'How confident are you writing clear, detailed text on a wide range of subjects?',
      skill: 'writing',
      category: 'writing',
      options: [
        { id: 'o1', text: 'I can only write simple isolated phrases and sentences.', points: 1 },
        { id: 'o2', text: 'I can write connected text on familiar topics with reasonable clarity.', points: 2 },
        { id: 'o3', text: 'I can write well-structured text expressing nuanced points of view.', points: 3 },
        { id: 'o4', text: 'I can write professional-quality text in any domain.', points: 4 },
      ],
    },
    {
      id: 'q6',
      text: 'How naturally can you interact in a conversation with native speakers?',
      skill: 'speaking',
      category: 'speaking',
      options: [
        { id: 'o1', text: 'I struggle to keep up and need them to adapt for me.', points: 1 },
        { id: 'o2', text: 'I can handle most situations with some pauses to think.', points: 2 },
        { id: 'o3', text: 'I interact fluently and spontaneously without strain for either party.', points: 3 },
        { id: 'o4', text: 'I can effortlessly participate in any conversation.', points: 4 },
      ],
    },
    {
      id: 'q7',
      text: 'How well can you read and understand authentic texts (articles, reports, literature)?',
      skill: 'reading',
      category: 'reading',
      options: [
        { id: 'o1', text: 'I can only understand very short, simple texts.', points: 1 },
        { id: 'o2', text: 'I understand contemporary prose and articles with occasional dictionary use.', points: 2 },
        { id: 'o3', text: 'I read complex literary and technical texts with ease.', points: 3 },
        { id: 'o4', text: 'I can critically analyse any written material.', points: 4 },
      ],
    },
    {
      id: 'q8',
      text: 'How accurately can you use grammar structures when speaking or writing?',
      skill: 'grammar',
      category: 'grammar',
      options: [
        { id: 'o1', text: 'I make frequent basic errors that sometimes cause misunderstanding.', points: 1 },
        { id: 'o2', text: 'I am generally accurate with occasional errors that do not cause misunderstanding.', points: 2 },
        { id: 'o3', text: 'I use grammar accurately and appropriately, even in complex structures.', points: 3 },
        { id: 'o4', text: 'I have near-perfect grammatical accuracy.', points: 4 },
      ],
    },
    {
      id: 'q9',
      text: 'How wide is your vocabulary range in real-world situations?',
      skill: 'vocabulary',
      category: 'vocabulary',
      options: [
        { id: 'o1', text: 'I rely on a limited set of basic words and phrases.', points: 1 },
        { id: 'o2', text: 'I have enough vocabulary to express myself on most everyday topics.', points: 2 },
        { id: 'o3', text: 'I have a broad vocabulary and can use idiomatic expressions naturally.', points: 3 },
        { id: 'o4', text: 'I have an extensive vocabulary comparable to a native speaker.', points: 4 },
      ],
    },
    {
      id: 'q10',
      text: 'How well can you summarise information from different spoken and written sources?',
      skill: 'reading',
      category: 'reading',
      options: [
        { id: 'o1', text: 'I find summarising very difficult and miss key points.', points: 1 },
        { id: 'o2', text: 'I can summarise the main points from simple sources.', points: 2 },
        { id: 'o3', text: 'I can reconstruct arguments and accounts coherently from multiple sources.', points: 3 },
        { id: 'o4', text: 'I can produce sophisticated syntheses across diverse sources.', points: 4 },
      ],
    },
  ];

  getQuestions(_language: string): QuizQuestion[] {
    return this.questions;
  }

  submitResults(_results: QuizResults): { received: boolean } {
    return { received: true };
  }

  evaluateResults(
    _language: string,
    answers: Record<string, number>,
  ): {
    totalScore: number;
    maxScore: number;
    percentage: number;
    suggestedCefr: string;
    description: string;
    skillBreakdown: Record<string, { score: number; total: number }>;
  } {
    const maxScore = this.questions.length * 4;
    const totalScore = Object.values(answers).reduce((sum, v) => sum + v, 0);
    const percentage = Math.round((totalScore / maxScore) * 100);

    const skillMap: Record<string, number[]> = {
      speaking: [1, 6],
      listening: [2, 4],
      writing: [3, 5],
      reading: [7],
      grammar: [8],
      vocabulary: [9],
    };

    const skillBreakdown: Record<string, { score: number; total: number }> = {};
    for (const [skill, qNums] of Object.entries(skillMap)) {
      let skillScore = 0;
      let skillTotal = 0;
      for (const qNum of qNums) {
        const key = `q${qNum}`;
        skillTotal += 4;
        skillScore += answers[key] ?? 1;
      }
      skillBreakdown[skill] = { score: skillScore, total: skillTotal };
    }

    let suggestedCefr: string;
    let description: string;

    if (percentage >= 90) {
      suggestedCefr = 'C2';
      description = 'You demonstrate near-native proficiency across all skill areas.';
    } else if (percentage >= 75) {
      suggestedCefr = 'C1';
      description = 'You have advanced proficiency with strong command of complex language.';
    } else if (percentage >= 60) {
      suggestedCefr = 'B2';
      description = 'You are an upper-intermediate learner with good conversational fluency.';
    } else if (percentage >= 45) {
      suggestedCefr = 'B1';
      description = 'You are an intermediate learner able to handle everyday situations.';
    } else if (percentage >= 25) {
      suggestedCefr = 'A2';
      description = 'You are an elementary learner with basic communication skills.';
    } else {
      suggestedCefr = 'A1';
      description = 'You are a beginner starting your language learning journey.';
    }

    return { totalScore, maxScore, percentage, suggestedCefr, description, skillBreakdown };
  }
}
