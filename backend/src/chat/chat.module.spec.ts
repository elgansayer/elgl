import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { MetricsModule } from '../metrics/metrics.module';
import { MetricsService } from '../metrics/metrics.service';
import { CentrifugoService } from './centrifugo.service';
import { ChatModule } from './chat.module';
import { ChatSearchController } from './chat-search.controller';
import { PersonalUnreadListener } from './listeners/personal-unread.listener';

describe('ChatModule', () => {
  it('registers the personal unread realtime listener', () => {
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(providers).toContain(PersonalUnreadListener);
  });

  it('registers the authenticated message search endpoint', () => {
    const controllers =
      (Reflect.getMetadata('controllers', ChatModule) as unknown[]) ?? [];

    expect(controllers).toContain(ChatSearchController);
  });

  describe('Centrifugo connection rate limiter wiring', () => {
    it('provides the limiter that guards POST /chat/token', () => {
      const providers =
        (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

      expect(providers).toContain(CentrifugoService);
    });

    it('relies on the global MetricsModule to provide the MetricsService the limiter reports to', () => {
      const exports = Reflect.getMetadata(
        MODULE_METADATA.EXPORTS,
        MetricsModule,
      ) as unknown[];

      expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, MetricsModule)).toBe(
        true,
      );
      expect(exports).toContain(MetricsService);
    });
  });
});
