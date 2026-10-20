import type { Mock } from 'vitest';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
    insertBuilder = { insert: vi.fn().mockResolvedValue({ error: null }) };
    mockSupabaseClient = { from: vi.fn().mockReturnValue(insertBuilder) };
    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('persists crash data through the service-role client', async () => {
    const payload: ClientErrorDto = {
      message: 'Test error',
      name: 'TypeError',
      url: 'https://example.com/page',
      userAgent: 'Browser',
      stackFrames: [{ fileName: 'app.ts', lineNumber: 10, columnNumber: 5 }],
      timestamp: '2026-08-25T10:00:00.000Z',
    };

    await service.recordClientError(payload);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('client_errors');
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
        name: 'TypeError',
        url: 'https://example.com/page',
        client_timestamp: '2026-08-25T10:00:00.000Z',
      }),
    );
  });

  it('redacts untrusted URL query strings, fragments, and credentials', async () => {
    await service.recordClientError({
      message: 'boom',
      url: 'https://user:password@example.com/path?token=secret#private',
    });

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/path' }),
    );
  });

  it('whitelists metadata instead of persisting arbitrary client objects', async () => {
    await service.recordClientError({
      message: 'boom',
      metadata: {
        status: 503,
        statusText: 'Unavailable',
        rawType: 'HttpErrorResponse',
        token: 'must-not-be-stored',
        privatePayload: { text: 'private message' },
      },
    });

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          status: 503,
          statusText: 'Unavailable',
          rawType: 'HttpErrorResponse',
        },
      }),
    );
  });

  it('uses null for absent optional fields', async () => {
    await service.recordClientError({ message: 'Minimal error' });

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
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

  it('fails closed on a rejected insert without logging provider details', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn');
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        error: { message: 'database leaked secret=abc' },
      }),
    });

    await expect(
      service.recordClientError({ message: 'boom' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    const log = warnSpy.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(log).toContain('Failed to persist client crash analytics');
    expect(log).not.toContain('secret=abc');
  });

  it('fails closed when the storage client throws', async () => {
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockRejectedValue(new Error('password=secret')),
    });

    await expect(
      service.recordClientError({ message: 'boom' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
