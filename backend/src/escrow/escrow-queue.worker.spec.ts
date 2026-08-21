import type { Mock } from 'vitest';

const { __mockProcessDegradedQueue } = vi.hoisted(() => ({
  __mockProcessDegradedQueue: vi
    .fn()
    .mockResolvedValue({ processed: 0, failed: 0 }),
}));

vi.mock('./escrow.service', () => ({
  EscrowService: vi.fn().mockImplementation(function () {
    return {
      processDegradedQueue: __mockProcessDegradedQueue,
    };
  }),
  __mockProcessDegradedQueue,
}));

import { EscrowQueueWorker } from './escrow-queue.worker';
import { EscrowService } from './escrow.service';

describe('EscrowQueueWorker', () => {
  let worker: EscrowQueueWorker;
  let mockProcessDegradedQueue: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessDegradedQueue = __mockProcessDegradedQueue as Mock;
    mockProcessDegradedQueue.mockResolvedValue({ processed: 0, failed: 0 });

    const escrowService = new EscrowService();
    worker = new EscrowQueueWorker(escrowService);
  });

  afterEach(() => {
    worker.stop();
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('onModuleInit / onModuleDestroy', () => {
    it('should start processing on module init', () => {
      const startSpy = vi.spyOn(worker, 'start');

      worker.onModuleInit();
      expect(startSpy).toHaveBeenCalled();

      worker.onModuleDestroy();
    });

    it('should stop processing on module destroy', () => {
      const stopSpy = vi.spyOn(worker, 'stop');

      worker.onModuleInit();
      worker.onModuleDestroy();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('start / stop', () => {
    it('should not start twice', () => {
      worker.start();
      worker.start();
      worker.stop();
    });

    it('should stop only once', () => {
      worker.start();
      worker.stop();
      worker.stop();
    });
  });

  it('should process the degraded queue on module init', () => {
    worker.onModuleInit();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(mockProcessDegradedQueue).toHaveBeenCalled();
        worker.onModuleDestroy();
        resolve();
      }, 100);
    });
  });

  it('should process queue with items', () => {
    mockProcessDegradedQueue.mockResolvedValue({
      processed: 3,
      failed: 1,
    });

    worker.onModuleInit();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(mockProcessDegradedQueue).toHaveBeenCalled();
        worker.onModuleDestroy();
        resolve();
      }, 100);
    });
  });

  it('should handle errors from queue processing gracefully', () => {
    mockProcessDegradedQueue.mockRejectedValue(
      new Error('Queue processing failed'),
    );

    worker.onModuleInit();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(mockProcessDegradedQueue).toHaveBeenCalled();
        worker.onModuleDestroy();
        resolve();
      }, 100);
    });
  });
});
