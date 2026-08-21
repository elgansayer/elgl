import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class LlmProxyService {
  constructor(private readonly configService: ConfigService) {}

  async proxyMessage(text: string): Promise<{ response: string }> {
    const response = await this.chatCompletion([
      { role: 'user', content: text },
    ]);
    return { response };
  }

  async chatCompletion(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    const apiUrl = this.configService.get<string>(
      'LLM_API_URL',
      'https://api.openai.com/v1/chat/completions',
    );
    const model = this.configService.get<string>('LLM_MODEL', 'gpt-4');

    const payload = {
      model,
      messages,
      max_tokens: 500,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }
}
