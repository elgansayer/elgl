import { HttpModule } from '@nestjs/axios';
import { EconomyModule } from './economy.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { AtomicEconomyController } from './atomic-economy.controller';
import { AtomicEconomyService } from './atomic-economy.service';
import { EconomyService } from './economy.service';

describe('EconomyModule', () => {
  it('should be defined', () => {
    expect(EconomyModule).toBeDefined();
  });

  it('should import the modules it depends on', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', EconomyModule) as unknown[]) ?? [];

    expect(importsMetadata).toContain(UsersModule);
    expect(importsMetadata).toContain(ChatModule);
    expect(importsMetadata).toContain(HttpModule);
  });

  it('should register AtomicEconomyController in its controllers metadata', () => {
    const controllersMetadata =
      (Reflect.getMetadata('controllers', EconomyModule) as unknown[]) ?? [];

    expect(controllersMetadata).toContain(AtomicEconomyController);
  });

  it('should bind EconomyService to AtomicEconomyService', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', EconomyModule) as unknown[]) ?? [];

    expect(providersMetadata).toContainEqual({
      provide: EconomyService,
      useClass: AtomicEconomyService,
    });
  });

  it('should export EconomyService', () => {
    const exportsMetadata =
      (Reflect.getMetadata('exports', EconomyModule) as unknown[]) ?? [];

    expect(exportsMetadata).toContain(EconomyService);
  });
});
