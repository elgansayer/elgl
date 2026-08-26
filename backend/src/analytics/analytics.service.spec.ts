import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Mock } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { AnalyticsService } from './analytics.service';
import { ClientErrorDto } from './dto/client-error.dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockSupabaseClient: { from: Mock };
  let mockSupabaseService: { getClient: Mock };
  let insertBuilder: { insert: Mock };

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    insertBuilder = {
      insert: vi.fn().mockResolvedValue({ error: null }),
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

  it('persists bounded operational crash telemetry', async () => {
    const payload: ClientErrorDto = {
      message: 'Test error message',
      name: 'TypeError',
      stack: 'Error: Test error\n    at foo (app.ts:10:5)',
      url: 'https://example.com/page?access_token=private#fragment',
      userAgent: 'Chrome/120',
      metadata: {
        category: 'global',
        renderingError: true,
        nestedPrivateData: { secret: 'must not persist' },
      },
      stackFrames: [{ fileName: 'app.ts', lineNumber: 10, columnNumber: 5 }],
      timestamp: '2026-08-07T00:00:00.000Z',
    };

    await service.recordClientError(payload);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('client_errors');
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error message',
        name: 'TypeError',
        stack: 'Error: Test error\n    at foo (app.ts:10:5)',
        url: 'https://example.com/page',
        user_agent: 'Chrome/120',
        metadata: { category: 'global', renderingError: true },
        stack_frames: [
          expect.objectContaining({
            fileName: 'app.ts',
            lineNumber: 10,
            columnNumber: 5,
          }),
        ],
        client_timestamp: '2026-08-07T00:00:00.000Z',
      }),
    );
  });

  it('redacts secret-shaped values at the persistence boundary', async () => {
    await service.recordClientError({
      message: 'Bearer secret-value access_token=private-value',
      stack: 'Error: eyJabcdefghijk.abcdefghijk.abcdefghijk',
      metadata: { action: 'api_key=private-value' },
    });

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Bearer [redacted] access_token=[redacted]',
        stack: 'Error: [redacted-jwt]',
        metadata: { action: 'api_key=[redacted]' },
      }),
    );
  });

  it('persists a minimal payload without inventing private context', async () => {
    await service.recordClientError({ message: 'Minimal error' });

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

  it('fails closed with a stable 503 when Supabase rejects the insert', async () => {
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: 'private db detail' } }),
    });
    const warnSpy = vi.spyOn(Logger.prototype, 'warn');

    await expect(
      service.recordClientError({ message: 'Test error' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(warnSpy).toHaveBeenCalledWith('client_error_persist_failed');
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('private db detail'),
    );
  });

  it('fails closed without leaking provider exception text', async () => {
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockRejectedValue(new Error('connection string leaked here')),
    });
    const warnSpy = vi.spyOn(Logger.prototype, 'warn');

    await expect(
      service.recordClientError({ message: 'Test error' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(warnSpy).toHaveBeenCalledWith('client_error_persist_exception');
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('connection string leaked here'),
    );
  });
});
