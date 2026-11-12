import {
  BadRequestException,
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildDataPrompt,
  requireScreenedReply,
} from '../llm-guard/prompt-guard';
import { ProviderPromptGate } from '../llm-guard/provider-prompt-gate';
import { MetricsService } from '../metrics/metrics.service';

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatLlmOptions {
  temperature?: number;
  maxTokens?: number;
}

const MAX_TARGET_LANGUAGE_CHARS = 64;
const MAX_TRANSLATION_CHARS = 8_000;

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
  private readonly promptGate: ProviderPromptGate;

  constructor(
    private readonly configService: ConfigService,
    @Optional() metricsService?: MetricsService,
  ) {
    this.promptGate = new ProviderPromptGate(
      'chat_llm',
      this.logger,
      metricsService,
    );
  }

  /**
   * Sends messages to the configured provider. Build them with
   * buildDataPrompt or buildConversationPrompt from llm-guard: the messages
   * are validated and cleaned here whatever the caller did, and a prompt that
   * did not come from a builder is reported as `unguarded`. Throws
   * PromptGuardError before any request is made when the messages are
   * malformed or too large.
   */
  async chatCompletion(
    rawMessages: LlmChatMessage[],
    options: ChatLlmOptions = {},
  ): Promise<string> {
    const { messages } = this.promptGate.harden(rawMessages);
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
          // The provider body can echo the (private) prompt, so keep only the
          // status for the log line and the API response.
          throw new HttpException(
            `Anthropic error: ${response.status}`,
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
        throw new HttpException(
          `OpenAI error: ${response.status}`,
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

  /** Proxies a multi-turn chat conversation to the configured LLM. */
  async proxyChatMessages(
    messages: LlmChatMessage[],
  ): Promise<{ response: string }> {
    const response = await this.chatCompletion(messages);
    return { response };
  }

  /**
   * Translates a given text into the specified target language using the configured LLM.
   * The text is untrusted data: it is JSON-encoded in the user message and the
   * answer is screened so it cannot introduce links the source did not contain.
   */
  async translateText(text: string, targetLanguage: string): Promise<string> {
    if (targetLanguage.length > MAX_TARGET_LANGUAGE_CHARS) {
      throw new BadRequestException('Target language is too long');
    }

    const response = await this.chatCompletion(
      buildDataPrompt({
        tool: 'message_translate',
        instructions: [
          'You are a precise translation engine.',
          'Translate the "text" field into the language named in the "target_language" field.',
          'Provide an accurate, natural translation and respond only with the translated text, without quotation marks, notes, explanations or commentary.',
          'Keep any URLs that appear in the text exactly as written.',
        ],
        data: { target_language: targetLanguage, text },
      }),
      { temperature: 0.2, maxTokens: 512 },
    );

    return requireScreenedReply(response, {
      maxLength: MAX_TRANSLATION_CHARS,
      sourceTexts: [text],
    });
  }
}
