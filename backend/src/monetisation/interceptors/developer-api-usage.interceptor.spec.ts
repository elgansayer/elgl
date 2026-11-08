import type { Mock } from 'vitest';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperApiUsageInterceptor } from './developer-api-usage.interceptor';
import { SupabaseService } from '../../supabase/supabase.service';

interface MockRequest {
  user?: { id: string };
  developerApiKeyAuthenticated?: boolean;
}

describe('DeveloperApiUsageInterceptor', () => {
  let interceptor: DeveloperApiUsageInterceptor;
  let rpc: Mock;

  beforeEach(async () => {
    rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeveloperApiUsageInterceptor,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue({ rpc }),
          },
        },
      ],
    }).compile();

    interceptor = module.get<DeveloperApiUsageInterceptor>(
      DeveloperApiUsageInterceptor,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function contextFor(request: MockRequest): ExecutionContext {
    return {
      getType: vi.fn().mockReturnValue('http'),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;
  }

  const next = (): CallHandler => ({ handle: () => of('ok') });

  it('does not record session-authenticated dashboard traffic', async () => {
    const request: MockRequest = { user: { id: 'user-1' } };

    await lastValueFrom(interceptor.intercept(contextFor(request), next()));
    await Promise.resolve();

    expect(rpc).not.toHaveBeenCalled();
  });

  it('records usage for API-key authenticated requests', async () => {
    const request: MockRequest = {
      user: { id: 'user-1' },
      developerApiKeyAuthenticated: true,
    };

    await lastValueFrom(interceptor.intercept(contextFor(request), next()));
    await Promise.resolve();

    expect(rpc).toHaveBeenCalledWith(
      'record_developer_api_usage',
      expect.objectContaining({
        p_user_id: 'user-1',
        p_latency_ms: expect.any(Number),
      }),
    );
  });

  it('does not break the response when usage recording fails', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });
    const request: MockRequest = {
      user: { id: 'user-2' },
      developerApiKeyAuthenticated: true,
    };

    await expect(
      lastValueFrom(interceptor.intercept(contextFor(request), next())),
    ).resolves.toBe('ok');
    await Promise.resolve();
  });
});
