import { Injectable, BadRequestException } from '@nestjs/common';
import { ChatLlmService, LlmChatMessage } from './chat-llm.service';

@Injectable()
export class ChatLlmProxyService {
  constructor(private readonly chatLlmService: ChatLlmService) {}

  async proxyChatMessage(
    userId: string,
    messageText: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ): Promise<{ response: string }> {
    if (!messageText || messageText.trim().length === 0) {
      throw new BadRequestException('Message text cannot be empty');
    }

    const messages: LlmChatMessage[] = [
      {
        role: 'system',
        content:
          "You are a helpful conversation partner for language learners. Reply in a friendly, concise manner. Ensure Comprehensible Input by using vocabulary slightly above the user's level (i+1). Encourage Active Production by asking open-ended questions. Use Retrieval Practice by referencing past conversation points. Facilitate Spaced Repetition by deliberately reusing recently learned vocabulary. Provide Meaningful Feedback by naturally modelling correct grammar.",
      },
      ...history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: messageText },
    ];

    return this.chatLlmService.proxyChatMessages(messages);
  }

  async proxyChatWithHistory(
    userId: string,
    conversation: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ response: string }> {
    if (!conversation || conversation.length === 0) {
      throw new BadRequestException('Conversation cannot be empty');
    }

    const messages: LlmChatMessage[] = [
      {
        role: 'system',
        content:
          "You are a helpful conversation partner for language learners. Reply in a friendly, concise manner. Ensure Comprehensible Input by using vocabulary slightly above the user's level (i+1). Encourage Active Production by asking open-ended questions. Use Retrieval Practice by referencing past conversation points. Facilitate Spaced Repetition by deliberately reusing recently learned vocabulary. Provide Meaningful Feedback by naturally modelling correct grammar.",
      },
      ...conversation.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    return this.chatLlmService.proxyChatMessages(messages);
  }
}
