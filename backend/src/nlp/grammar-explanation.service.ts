import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { buildDataPrompt } from '../llm-guard/prompt-guard';
import { screenModelOutput } from '../llm-guard/untrusted-text';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { MetricsService } from '../metrics/metrics.service';
import { ExplainGrammarDto } from './dto/explain-grammar.dto';

const PROVIDER_TIMEOUT_MS = 10_000;
const MAX_EXPLANATION_LENGTH = 2_500;
const METRICS_ENDPOINT = 'explain-grammar';

export interface GrammarExplanationResult {
  original: string;
  corrected: string;
  explanation: string;
}

/** Stable, low-cardinality failure categories shared by logs and metrics. */
type GrammarExplanationFailureReason =
  'timeout' | 'provider_error' | 'invalid_response';

/**
 * Carries only a failure category and, when the provider call itself threw,
 * the class name of that exception. Provider messages can echo private
 * sentences, so they are never attached to this error or to the logs.
 */
class GrammarExplanationFailure extends Error {
  constructor(
    readonly reason: GrammarExplanationFailureReason,
    readonly providerErrorName?: string,
  ) {
    super(`Grammar explanation failed: ${reason}`);
    this.name = 'GrammarExplanationFailure';
  }
}

@Injectable()
export class GrammarExplanationService {
  constructor(
    @InjectPinoLogger(GrammarExplanationService.name)
    private readonly logger: PinoLogger,
    private readonly llmProxyService: LlmProxyService,
    private readonly metricsService: MetricsService,
  ) {}

  async explain(
    userId: string,
    dto: ExplainGrammarDto,
  ): Promise<GrammarExplanationResult> {
    const original = dto.original.trim();
    const corrected = dto.corrected.trim();
    const startedAt = performance.now();

    let explanation: string;
    try {
      explanation = await this.requestExplanation(original, corrected);
    } catch (error) {
      this.recordFailure(userId, this.toFailure(error), startedAt);
      throw new ServiceUnavailableException(
        'Grammar explanation is temporarily unavailable',
      );
    }

    // Outside the try block so a bookkeeping fault can never turn a delivered
    // explanation into an error response.
    this.recordSuccess(startedAt);
    return { original, corrected, explanation };
  }

  private async requestExplanation(
    original: string,
    corrected: string,
  ): Promise<string> {
    const messages = buildDataPrompt({
      tool: 'grammar_explanation',
      instructions: [
        'You are a concise grammar tutor for a language-exchange application.',
        'The JSON document holds an "original" sentence and a "corrected" sentence written by a learner.',
        'Explain only the meaningful grammar, spelling, punctuation, word-choice, or agreement differences between the two sentences.',
        'Provide Meaningful Feedback by explaining the *why* behind corrections in a clear, pedagogical way.',
        'Use plain text, no Markdown tables, no HTML, and no preamble.',
        'Prefer 2-6 short sentences. Name the relevant rule when useful and explain why the correction is more natural.',
        'Do not invent differences that are not present.',
      ],
      data: { original, corrected },
    });

    const response = await this.withTimeout(
      (signal) => this.llmProxyService.chatCompletion(messages, signal),
      PROVIDER_TIMEOUT_MS,
    );

    // Links are removed unless a sentence already contained them, so an
    // injected instruction cannot make the tutor publish a link.
    const screened = screenModelOutput(response, {
      maxLength: MAX_EXPLANATION_LENGTH,
      sourceTexts: [original, corrected],
    });
    if (screened.text.length === 0 || screened.tooLong) {
      throw new GrammarExplanationFailure('invalid_response');
    }
    return screened.text;
  }

  /** Anything that is not already categorised came from the provider call. */
  private toFailure(error: unknown): GrammarExplanationFailure {
    return error instanceof GrammarExplanationFailure
      ? error
      : new GrammarExplanationFailure(
          'provider_error',
          error instanceof Error ? error.name : 'unknown',
        );
  }

  private recordSuccess(startedAt: number): void {
    this.metricsService.recordReadingEngineAiRequest(METRICS_ENDPOINT, '200');
    this.metricsService.recordReadingEngineAiRequestDuration(
      METRICS_ENDPOINT,
      this.secondsSince(startedAt),
    );
  }

  private recordFailure(
    userId: string,
    failure: GrammarExplanationFailure,
    startedAt: number,
  ): void {
    const seconds = this.secondsSince(startedAt);
    this.metricsService.recordReadingEngineAiRequest(METRICS_ENDPOINT, '503');
    this.metricsService.recordReadingEngineAiRequestDuration(
      METRICS_ENDPOINT,
      seconds,
    );
    this.metricsService.recordReadingEngineAiError(
      METRICS_ENDPOINT,
      failure.reason,
    );
    // Category, latency and the provider exception class only: never the
    // sentences, the provider message or any credential. The user id and the
    // route added by pino-http let support match a report to this line.
    this.logger.warn(
      {
        event: 'grammar_explanation_failed',
        reason: failure.reason,
        userId,
        latencyMs: Math.round(seconds * 1000),
        providerErrorName: failure.providerErrorName,
      },
      'Grammar explanation unavailable',
    );
  }

  private secondsSince(startedAt: number): number {
    return (performance.now() - startedAt) / 1000;
  }

  /**
   * Runs the provider call under a deadline. On expiry the signal is aborted
   * so the in-flight HTTP request is cancelled rather than left running (and
   * billed) in the background after the user already received an error.
   */
  private async withTimeout<T>(
    run: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const failure = new GrammarExplanationFailure('timeout');
        controller.abort(failure);
        reject(failure);
      }, timeoutMs);
    });

    try {
      return await Promise.race([run(controller.signal), timeoutPromise]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }
}
