import { ChatModule } from './chat.module';
import { ChatSearchController } from './chat-search.controller';
import { ChatTypingController } from './chat-typing.controller';
import { ChatTypingService } from './chat-typing.service';
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

  it('registers the authenticated typing presence endpoint', () => {
    const controllers =
      (Reflect.getMetadata('controllers', ChatModule) as unknown[]) ?? [];
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(controllers).toContain(ChatTypingController);
    expect(providers).toContain(ChatTypingService);
  });
});
