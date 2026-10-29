import { ChatEditController } from './chat-edit.controller';
import { ChatForwardController } from './chat-forward.controller';
import { ChatModule } from './chat.module';
import { ChatSearchController } from './chat-search.controller';
import { ChatService } from './chat.service';
import { SecureChatService } from './secure-chat.service';

describe('ChatModule', () => {
  it('registers the authenticated message mutation and search routes', () => {
    const controllers =
      (Reflect.getMetadata('controllers', ChatModule) as unknown[]) ?? [];

    expect(controllers).toContain(ChatEditController);
    expect(controllers).toContain(ChatForwardController);
    expect(controllers).toContain(ChatSearchController);
  });

  it('uses the membership-enforcing chat service in production', () => {
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(providers).toContainEqual({
      provide: ChatService,
      useClass: SecureChatService,
    });
    expect(providers).not.toContain(ChatService);
  });
});
