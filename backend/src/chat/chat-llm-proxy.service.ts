import { Injectable, BadRequestException } from '@nestjs/common';
import {
  buildConversationPrompt,
  requireScreenedReply,
} from '../llm-guard/prompt-guard';
import { ChatLlmService } from './chat-llm.service';

const MAX_REPLY_CHARS = 8_000;

export const CONVERSATION_PARTNER_INSTRUCTIONS = [
  "You are a helpful conversation partner for language learners. Reply in a friendly, concise manner. Ensure Comprehensible Input by using vocabulary slightly above the user's level (i+1). Encourage Active Production by asking open-ended questions. Use Retrieval Practice by referencing past conversation points. Facilitate Spaced Repetition by deliberately reusing recently learned vocabulary. Provide Meaningful Feedback by naturally modelling correct grammar.",
];

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

    return this.reply(
      buildConversationPrompt({
        tool: 'chat_llm_proxy',
        instructions: CONVERSATION_PARTNER_INSTRUCTIONS,
        history,
        message: messageText,
      }),
    );
  }

  async proxyChatWithHistory(
    userId: string,
    conversation: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ response: string }> {
    if (!conversation || conversation.length === 0) {
      throw new BadRequestException('Conversation cannot be empty');
    }

    return this.reply(
      buildConversationPrompt({
        tool: 'chat_llm_proxy',
        instructions: CONVERSATION_PARTNER_INSTRUCTIONS,
        history: conversation,
      }),
    );
  }

  private async reply(
    messages: Parameters<ChatLlmService['proxyChatMessages']>[0],
  ): Promise<{ response: string }> {
    const result = await this.chatLlmService.proxyChatMessages(messages);
    return {
      response: requireScreenedReply(result.response, {
        maxLength: MAX_REPLY_CHARS,
      }),
    };
  }
}
