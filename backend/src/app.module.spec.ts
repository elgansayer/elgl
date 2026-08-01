import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

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

describe('AppModule', () => {
  it('should be defined', () => {
    expect(AppModule).toBeDefined();
  });

  it('should register the AppController in its controllers metadata', () => {
    const controllersMetadata =
      (Reflect.getMetadata('controllers', AppModule) as unknown[]) ?? [];

    expect(controllersMetadata).toContain(AppController);
  });

  it('should register AppService in its providers metadata', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', AppModule) as unknown[]) ?? [];

    expect(providersMetadata).toContain(AppService);
  });

  it('should register the global APP_GUARD provider that uses ThrottlerGuard', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', AppModule) as unknown[]) ?? [];

    const guardProvider = findProvider(providersMetadata, APP_GUARD) as
      { provide: string; useClass: typeof ThrottlerGuard } | undefined;

    expect(guardProvider).toBeDefined();
    expect(guardProvider?.useClass).toBe(ThrottlerGuard);
  });
});
