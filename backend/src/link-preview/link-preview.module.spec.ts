import { HttpModule, HttpService } from '@nestjs/axios';
import { BadRequestException } from '@nestjs/common';
import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { MetricsModule } from '../metrics/metrics.module';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { LinkPreviewController } from './link-preview.controller';
import { LinkPreviewModule } from './link-preview.module';
import { LinkPreviewService } from './link-preview.service';

type RedisProvider = {
  provide: string;
  inject: unknown[];
  useFactory: (supabaseService: SupabaseService) => unknown;
};

describe('LinkPreviewModule', () => {
  it('owns the HTTP and Supabase dependencies used by the scraper', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      LinkPreviewModule,
    ) as unknown[];

    expect(imports).toEqual(
      expect.arrayContaining([HttpModule, SupabaseModule]),
    );
  });

  it('registers the public controller and scraper service', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      LinkPreviewModule,
    ) as unknown[];
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      LinkPreviewModule,
    ) as unknown[];

    expect(controllers).toContain(LinkPreviewController);
    expect(providers).toContain(LinkPreviewService);
  });

  it('provides Redis through the shared Supabase service', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      LinkPreviewModule,
    ) as unknown[];
    const redisProvider = providers.find(
      (provider): provider is RedisProvider =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        provider.provide === 'REDIS_CLIENT',
    );

    expect(redisProvider).toBeDefined();
    expect(redisProvider?.inject).toContain(SupabaseService);

    const redisClient = { get: vi.fn(), set: vi.fn() };
    const getRedisClient = vi.fn().mockReturnValue(redisClient);
    const supabaseService = {
      getRedisClient,
    } as unknown as SupabaseService;

    expect(redisProvider?.useFactory(supabaseService)).toBe(redisClient);
    expect(getRedisClient).toHaveBeenCalledTimes(1);
  });

  it('exports LinkPreviewService for chat enrichment and other internal callers', () => {
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      LinkPreviewModule,
    ) as unknown[];

    expect(exports).toContain(LinkPreviewService);
  });

  describe('metrics wiring', () => {
    it('relies on the global MetricsModule to provide MetricsService', () => {
      const exports = Reflect.getMetadata(
        MODULE_METADATA.EXPORTS,
        MetricsModule,
      ) as unknown[];

      expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, MetricsModule)).toBe(
        true,
      );
      expect(exports).toContain(MetricsService);
    });

    it('resolves the scraper with the real MetricsService and exports its series', async () => {
      const module = await Test.createTestingModule({
        providers: [
          LinkPreviewService,
          MetricsService,
          { provide: HttpService, useValue: { get: vi.fn() } },
          { provide: 'REDIS_CLIENT', useValue: { get: vi.fn(), set: vi.fn() } },
        ],
      }).compile();
      const service = module.get(LinkPreviewService);
      const metrics = module.get(MetricsService);

      await expect(
        service.getPreview('http://169.254.169.254/latest/meta-data/'),
      ).rejects.toBeInstanceOf(BadRequestException);

      const exported = await metrics.getMetrics();
      expect(exported).toContain(
        'hellotalk_link_preview_requests_total{outcome="rejected"} 1',
      );
      expect(exported).toContain(
        'hellotalk_link_preview_failures_total{reason="blocked_target"} 1',
      );
      expect(exported).not.toContain('169.254.169.254');
    });
  });
});
