import { Injectable } from '@nestjs/common';

@Injectable()
export class AiConversationService {
  generateReply(userMessage: string): string {
    const replies = [
      'That is fascinating! Can you tell me more about it?',
      'I see. How does that make you feel?',
      'Ah, I understand. What else have you been learning?',
      'Interesting point. Do you have an example?',
      'I appreciate your perspective. Could you elaborate?',
      'Great question! Let me think...',
      'I agree. Have you tried any new language techniques recently?',
      'That reminds me of something I read. Keep going!',
      'Nice! You are making excellent progress.',
      'Hmm, let me reflect on that.',
    ];
    const index = userMessage.length % replies.length;
    return replies[index];
  }
}
