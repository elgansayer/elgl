import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatLlmOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

@Injectable()
export class ChatLlmService {
  private readonly logger = new Logger(ChatLlmService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateText(
    prompt: string,
    options: ChatLlmOptions = {},
  ): Promise<string> {
    const messages: LlmChatMessage[] = [];
    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: prompt });
    return this.chatCompletion(messages, options);
  }

  async chatCompletion(
    messages: LlmChatMessage[],
    options: ChatLlmOptions = {},
  ): Promise<string> {
    const provider = this.configService.get<string>('LLM_PROVIDER', 'openai');
    const apiKey = this.configService.get<string>('LLM_API_KEY');

    if (!apiKey) {
      throw new HttpException(
        'LLM_API_KEY is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const baseUrl =
      this.configService.get<string>('LLM_BASE_URL') ??
      (provider === 'anthropic'
        ? 'https://api.anthropic.com/v1/messages'
        : 'https://api.openai.com/v1/chat/completions');

    const model =
      this.configService.get<string>('LLM_MODEL') ??
      (provider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini');

    try {
      if (provider === 'anthropic') {
        const anthropicVersion = this.configService.get<string>(
          'ANTHROPIC_VERSION',
          '2023-06-01',
        );

        const systemMessages = messages.filter((m) => m.role === 'system');
        const nonSystemMessages = messages.filter((m) => m.role !== 'system');

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': anthropicVersion,
          },
          body: JSON.stringify({
            model,
            max_tokens: options.maxTokens ?? 1024,
            system: systemMessages.map((m) => m.content).join('\n'),
            messages: nonSystemMessages.map((m) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new HttpException(
            `Anthropic error: ${response.status} ${text}`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        const json: unknown = await response.json();
        if (!isRecord(json)) {
          throw new HttpException(
            'Invalid Anthropic response',
            HttpStatus.BAD_GATEWAY,
          );
        }

        const content = json.content;
        if (!isArray(content)) {
          throw new HttpException(
            'Invalid Anthropic content',
            HttpStatus.BAD_GATEWAY,
          );
        }

        if (content.length === 0) {
          throw new HttpException(
            'Empty Anthropic content',
            HttpStatus.BAD_GATEWAY,
          );
        }

        const first = content[0];
        if (!isRecord(first)) {
          throw new HttpException(
            'Invalid Anthropic content item',
            HttpStatus.BAD_GATEWAY,
          );
        }

        const text = first.text;
        if (!isString(text) || text.trim().length === 0) {
          throw new HttpException(
            'Missing text in Anthropic response',
            HttpStatus.BAD_GATEWAY,
          );
        }

        return text.trim();
      }

      // Default OpenAI-compatible API
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new HttpException(
          `OpenAI error: ${response.status} ${text}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const json: unknown = await response.json();
      if (!isRecord(json)) {
        throw new HttpException(
          'Invalid OpenAI response',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const choices = json.choices;
      if (!isArray(choices) || choices.length === 0) {
        throw new HttpException('Empty OpenAI choices', HttpStatus.BAD_GATEWAY);
      }

      const firstChoice = choices[0];
      if (!isRecord(firstChoice)) {
        throw new HttpException(
          'Invalid OpenAI choice',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const message = firstChoice.message;
      if (!isRecord(message)) {
        throw new HttpException(
          'Invalid OpenAI message',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const content = message.content;
      if (!isString(content) || content.trim().length === 0) {
        throw new HttpException(
          'Missing text in OpenAI response',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return content.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('LLM proxy call failed', message);
      throw error;
    }
  }

  /** Proxies a single prompt to the configured LLM and returns the text response. */
  async proxyMessage(prompt: string): Promise<{ response: string }> {
    const response = await this.generateText(prompt);
    return { response };
  }

  /** Proxies a multi-turn chat conversation to the configured LLM. */
  async proxyChatMessages(
    messages: LlmChatMessage[],
  ): Promise<{ response: string }> {
    const response = await this.chatCompletion(messages);
    return { response };
  }

  /**
   * Translates a given text into the specified target language using the configured LLM.
   */
  async translateText(text: string, targetLanguage: string): Promise<string> {
    const prompt = `Translate the following text into ${targetLanguage}. Respond only with the translated text, without any surrounding quotes or commentary.\n\n${text}`;
    const response = await this.generateText(prompt, {
      system:
        'You are a precise translation engine. Provide accurate natural translations without adding explanations.',
      temperature: 0.2,
      maxTokens: 512,
    });
    return response.trim();
  }
}
