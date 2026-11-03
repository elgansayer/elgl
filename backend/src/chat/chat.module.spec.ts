import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { MetricsModule } from '../metrics/metrics.module';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatModule } from './chat.module';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatMediaSendController } from './chat-media-send.controller';
import { ChatService } from './chat.service';
import { PersonalUnreadListener } from './listeners/personal-unread.listener';

function metadata(key: string, target: unknown): unknown[] {
  const value: unknown = Reflect.getMetadata(key, target as object);
  return Array.isArray(value) ? value : [];
}

/** Everything Nest could inject into ChatModule: its providers, what its imports export, and global modules. */
function injectableTokens(): Set<unknown> {
  const tokens = new Set<unknown>(metadata('providers', ChatModule));
  for (const imported of metadata('imports', ChatModule)) {
    // forwardRef(() => Module) wrappers carry no module metadata of their own.
    for (const exported of metadata('exports', imported)) tokens.add(exported);
  }
  return tokens;
}

describe('ChatModule', () => {
  it('registers the personal unread realtime listener', () => {
    expect(metadata('providers', ChatModule)).toContain(PersonalUnreadListener);
  });

  it('registers the authenticated uploaded-media send boundary', () => {
    expect(metadata('controllers', ChatModule)).toContain(
      ChatMediaSendController,
    );
    expect(metadata('providers', ChatModule)).toContain(
      ChatMediaMessageService,
    );
  });

  it('can supply every collaborator of the uploaded-media send boundary', () => {
    const available = injectableTokens();
    const serviceDependencies = metadata(
      'design:paramtypes',
      ChatMediaMessageService,
    );
    const controllerDependencies = metadata(
      'design:paramtypes',
      ChatMediaSendController,
    );

    expect(serviceDependencies).toEqual([
      R2ObjectService,
      SupabaseService,
      ChatService,
      MetricsService,
    ]);
    expect(controllerDependencies).toEqual([ChatMediaMessageService]);
    for (const dependency of [
      ...serviceDependencies,
      ...controllerDependencies,
    ]) {
      // SupabaseModule is global, so SupabaseService is supplied app-wide rather than by ChatModule.
      if (dependency === SupabaseService) continue;
      expect(available).toContain(dependency);
    }
  });

  it('imports the metrics module so the send outcome counter is injectable', () => {
    expect(metadata('imports', ChatModule)).toContain(MetricsModule);
    expect(metadata('exports', MetricsModule)).toContain(MetricsService);
  });
});
