import type { Logger } from '@nestjs/common';
import type { MetricsService } from '../metrics/metrics.service';
import {
  hardenMessages,
  PromptGuardError,
  type HardenedPrompt,
  type LlmToolLabel,
} from './prompt-guard';

type ProviderClient = 'llm_proxy' | 'chat_llm';

/**
 * The gate every provider client puts in front of its HTTP call. It hardens
 * the messages (see hardenMessages) and reports what it found as one
 * structured log line and a bounded set of counters.
 *
 * Only categories, counts and the tool name are recorded. The prompt, the
 * matched text and the provider response are private user content and never
 * reach a log or a metric label. Telemetry is best effort: a failure in it is
 * swallowed so bookkeeping can never turn a working AI request into an error.
 */
export class ProviderPromptGate {
  constructor(
    private readonly client: ProviderClient,
    private readonly logger: Logger,
    private readonly metrics?: Pick<
      MetricsService,
      'recordLlmPromptGuardEvent'
    >,
  ) {}

  /** Returns the hardened messages or throws PromptGuardError. */
  harden(messages: unknown): HardenedPrompt {
    let hardened: HardenedPrompt;
    try {
      hardened = hardenMessages(messages);
    } catch (error) {
      if (error instanceof PromptGuardError) this.recordRejected(error);
      throw error;
    }
    this.recordHardened(hardened);
    return hardened;
  }

  private recordHardened(prompt: HardenedPrompt): void {
    const events: string[] = prompt.signals.map((signal) => `signal_${signal}`);
    if (prompt.tool === 'unguarded') events.push('unguarded_call');
    if (prompt.quarantined > 0) events.push('quarantined');
    if (prompt.dropped > 0) events.push('history_dropped');
    if (prompt.sanitised > 0) events.push('sanitised');
    if (events.length === 0) return;

    this.emit(prompt.tool, events);

    // Sanitising alone is routine (pasted text often carries zero-width
    // characters), so only findings that suggest an attempt are logged.
    if (events.every((event) => event === 'sanitised')) return;
    this.log({
      event: 'llm_prompt_guard_finding',
      client: this.client,
      tool: prompt.tool,
      signals: prompt.signals,
      quarantined: prompt.quarantined,
      droppedHistoryEntries: prompt.dropped,
      sanitised: prompt.sanitised,
    });
  }

  private recordRejected(error: PromptGuardError): void {
    this.emit(error.tool, [`rejected_${error.code}`]);
    this.log({
      event: 'llm_prompt_guard_rejected',
      client: this.client,
      tool: error.tool,
      reason: error.code,
    });
  }

  private emit(tool: LlmToolLabel, events: readonly string[]): void {
    try {
      for (const event of events) {
        this.metrics?.recordLlmPromptGuardEvent(tool, event);
      }
    } catch {
      // Metrics must never break the request.
    }
  }

  private log(fields: Record<string, unknown>): void {
    try {
      this.logger.warn(fields);
    } catch {
      // Logging must never break the request.
    }
  }
}
