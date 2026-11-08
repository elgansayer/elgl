import { ChatModule } from './chat.module';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatMediaSendController } from './chat-media-send.controller';
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

  it('registers the authenticated chat media send boundary', () => {
    const controllers =
      (Reflect.getMetadata('controllers', ChatModule) as unknown[]) ?? [];
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(controllers).toContain(ChatMediaSendController);
    expect(providers).toContain(ChatMediaMessageService);
  });
});
