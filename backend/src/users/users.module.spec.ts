import { UsersModule } from './users.module';
import { UsersController } from './users.controller';
import { DeviceLinkController } from './device-link.controller';
import { UsersService } from './users.service';
import { DataExportWorker } from './data-export.worker';
import { AccountDeletionCron } from './cron/account-deletion.cron';
import { LastActiveInterceptor } from './interceptors/last-active.interceptor';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MediaModule } from '../media/media.module';
import { XpModule } from '../xp/xp.module';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { APP_INTERCEPTOR } from '@nestjs/core';

type ProviderToken = unknown;

function findProvider(
  providers: unknown[],
  providerToken: ProviderToken,
): unknown {
  return providers.find((provider): boolean => {
    if (typeof provider === 'object' && provider !== null) {
      const partial = provider as { provide?: ProviderToken };
      return partial.provide === providerToken;
    }
    return false;
  });
}

describe('UsersModule', () => {
  it('should be defined', () => {
    expect(UsersModule).toBeDefined();
  });

  it('should import the modules it depends on', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', UsersModule) as unknown[]) ?? [];

    expect(importsMetadata).toContain(SupabaseModule);
    expect(importsMetadata).toContain(NotificationsModule);
    expect(importsMetadata).toContain(MediaModule);
    expect(importsMetadata).toContain(XpModule);
    expect(importsMetadata).toContain(TwoFactorModule);
  });

  it('should register UsersController and DeviceLinkController in its controllers metadata', () => {
    const controllersMetadata =
      (Reflect.getMetadata('controllers', UsersModule) as unknown[]) ?? [];

    expect(controllersMetadata).toContain(UsersController);
    expect(controllersMetadata).toContain(DeviceLinkController);
  });

  it('should register UsersService, DataExportWorker and AccountDeletionCron in its providers metadata', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', UsersModule) as unknown[]) ?? [];

    expect(providersMetadata).toContain(UsersService);
    expect(providersMetadata).toContain(DataExportWorker);
    expect(providersMetadata).toContain(AccountDeletionCron);
  });

  it('should register the global APP_INTERCEPTOR provider that uses LastActiveInterceptor', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', UsersModule) as unknown[]) ?? [];

    const interceptorProvider = findProvider(
      providersMetadata,
      APP_INTERCEPTOR,
    ) as
      { provide: string; useClass: typeof LastActiveInterceptor } | undefined;

    expect(interceptorProvider).toBeDefined();
    expect(interceptorProvider?.useClass).toBe(LastActiveInterceptor);
  });

  it('should export UsersService', () => {
    const exportsMetadata =
      (Reflect.getMetadata('exports', UsersModule) as unknown[]) ?? [];

    expect(exportsMetadata).toContain(UsersService);
  });
});
