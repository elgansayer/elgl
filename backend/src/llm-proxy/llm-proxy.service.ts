import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class LlmProxyService {
  constructor(private readonly configService: ConfigService) {}

  async proxyMessage(
    text: string,
    signal?: AbortSignal,
  ): Promise<{ response: string }> {
    const response = await this.chatCompletion(
      [{ role: 'user', content: text }],
      signal,
    );
    return { response };
  }

  async chatCompletion(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): Promise<string> {
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
      signal,
    });
    if (!response.ok) {
      throw new Error(`LLM provider returned HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.choices)) return '';
    const choices = data.choices as unknown[];
    const firstChoice = choices[0];
    if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return '';
    return typeof firstChoice.message.content === 'string'
      ? firstChoice.message.content
      : '';
  }
}
