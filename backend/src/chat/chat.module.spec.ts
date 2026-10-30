import { ChatModule } from './chat.module';
import { PersonalUnreadListener } from './listeners/personal-unread.listener';

describe('ChatModule', () => {
  it('registers the personal unread realtime listener', () => {
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(providers).toContain(PersonalUnreadListener);
  });
});
