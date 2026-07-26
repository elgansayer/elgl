import { Injectable } from '@nestjs/common';

@Injectable()
export class QuizService {
  getQuestions(language: string) {
    // Mock data for the diagnostic quiz fetched from database in a real scenario
    return [
      {
        id: 'q1',
        text: 'How well can you introduce yourself and answer basic questions about your personal details?',
        options: [
          { id: 'o1', text: 'I struggle to understand and reply.', points: 1 },
          { id: 'o2', text: 'I can do it with simple phrases if the other person speaks slowly.', points: 2 },
          { id: 'o3', text: 'I can do it easily and confidently.', points: 3 },
        ],
      },
      {
        id: 'q2',
        text: 'Can you understand the main points of clear standard input on familiar matters regularly encountered in work, school, leisure, etc.?',
        options: [
          { id: 'o1', text: 'No, I need translation for most things.', points: 1 },
          { id: 'o2', text: 'Yes, if the topic is very familiar to me.', points: 2 },
          { id: 'o3', text: 'Yes, I understand almost everything clearly.', points: 3 },
        ],
      },
      {
        id: 'q3',
        text: 'How comfortable are you expressing your opinions and providing explanations for your plans?',
        options: [
          { id: 'o1', text: 'I cannot do this yet.', points: 1 },
          { id: 'o2', text: 'I can give brief reasons and explanations.', points: 2 },
          { id: 'o3', text: 'I can express myself fluently and spontaneously.', points: 3 },
        ],
      }
    ];
  }
}
