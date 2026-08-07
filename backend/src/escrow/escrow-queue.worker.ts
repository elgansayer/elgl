import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';

const PROCESSING_INTERVAL_MS = 30_000;

@Injectable()
export class EscrowQueueWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscrowQueueWorker.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly escrowService: EscrowService) {}

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(): void {
    if (this.intervalHandle) return;

    this.logger.log('Starting escrow degraded queue worker');
    // Process immediately on start, then every interval
    void this.processQueue();
    this.intervalHandle = setInterval(() => {
      void this.processQueue();
    }, PROCESSING_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log('Stopped escrow degraded queue worker');
    }
  }

  private async processQueue(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const result = await this.escrowService.processDegradedQueue();
      if (result.processed > 0 || result.failed > 0) {
        this.logger.log(
          `Queue processed: ${result.processed} succeeded, ${result.failed} failed`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Queue worker error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
