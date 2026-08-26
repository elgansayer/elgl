import { HttpModule } from '@nestjs/axios';
import { MODULE_METADATA } from '@nestjs/common/constants';
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

    expect(imports).toEqual(expect.arrayContaining([HttpModule, SupabaseModule]));
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
});
