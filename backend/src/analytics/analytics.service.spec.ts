import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ClientErrorDto } from './dto/client-error.dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockSupabaseClient: { from: Mock };
  let mockSupabaseService: { getClient: Mock };
  let insertBuilder: { insert: Mock };

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    insertBuilder = {
      insert: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(insertBuilder),
    };

    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordClientError', () => {
    const validPayload: ClientErrorDto = {
      message: 'Test error message',
      name: 'TypeError',
      stack: 'Error: Test error\n    at foo (app.ts:10:5)',
      componentStack: undefined,
      url: 'https://example.com/page',
      userAgent: 'Chrome/120',
      metadata: { userId: 'user-1' },
      stackFrames: [{ fileName: 'app.ts', lineNumber: 10, columnNumber: 5 }],
      timestamp: '2026-08-07T00:00:00.000Z',
    };

    it('inserts client error into supabase with full payload', async () => {
      await service.recordClientError(validPayload);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('client_errors');
      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error message',
          name: 'TypeError',
          stack: 'Error: Test error\n    at foo (app.ts:10:5)',
          url: 'https://example.com/page',
          user_agent: 'Chrome/120',
          metadata: { userId: 'user-1' },
          stack_frames: [
            { fileName: 'app.ts', lineNumber: 10, columnNumber: 5 },
          ],
          client_timestamp: '2026-08-07T00:00:00.000Z',
        }),
      );
    });

    it('inserts client error with minimal payload (only message)', async () => {
      const minimalPayload: ClientErrorDto = {
        message: 'Minimal error',
      };

      await service.recordClientError(minimalPayload);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('client_errors');
      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Minimal error',
          name: 'Error',
          stack: null,
          component_stack: null,
          url: null,
          user_agent: null,
          metadata: null,
          stack_frames: null,
        }),
      );
    });

    it('logs a warning when supabase insert returns an error', async () => {
      const errorInsertBuilder = {
        insert: vi.fn().mockResolvedValue({ error: { message: 'db error' } }),
      };
      mockSupabaseClient.from.mockReturnValue(errorInsertBuilder);
      const warnSpy = vi.spyOn(Logger.prototype, 'warn');

      await service.recordClientError(validPayload);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log client error: db error'),
      );
    });

    it('logs a warning when insertBuilder throws an exception', async () => {
      const errorInsertBuilder = {
        insert: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };
      mockSupabaseClient.from.mockReturnValue(errorInsertBuilder);
      const warnSpy = vi.spyOn(Logger.prototype, 'warn');

      await service.recordClientError(validPayload);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Exception while recording client error: Connection refused',
        ),
      );
    });
  });
});
