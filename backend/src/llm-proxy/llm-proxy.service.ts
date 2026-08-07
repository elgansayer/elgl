import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LlmProxyService {
  constructor(private readonly configService: ConfigService) {}

  async proxyMessage(text: string): Promise<{ response: string }> {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    const apiUrl = this.configService.get<string>(
      'LLM_API_URL',
      'https://api.openai.com/v1/chat/completions',
    );
    const model = this.configService.get<string>('LLM_MODEL', 'gpt-4');

    const payload = {
      model,
      messages: [{ role: 'user', content: text }],
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
    const replyText = data?.choices?.[0]?.message?.content ?? '';
    return { response: replyText };
  }
}
