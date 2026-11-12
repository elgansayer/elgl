import { ChatModule } from './chat.module';
import { ChatService } from './chat.service';
import { ChatSearchController } from './chat-search.controller';
import { PersonalUnreadListener } from './listeners/personal-unread.listener';
import { SecureChatService } from './secure-chat.service';

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

  it('routes chat operations through the membership-enforcing service', () => {
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(providers).toContainEqual({
      provide: ChatService,
      useClass: SecureChatService,
    });
    expect(providers).not.toContain(ChatService);
  });
});
