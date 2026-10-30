import { ChatModule } from './chat.module';
import { ChatService } from './chat.service';
import { SecureChatService } from './secure-chat.service';

describe('ChatModule', () => {
  it('routes chat operations through the membership-enforcing service', () => {
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(providers).toContainEqual({
      provide: ChatService,
      useClass: SecureChatService,
    });
    expect(providers).not.toContain(ChatService);
  });

  it('exports the secured ChatService token', () => {
    const exportsMetadata =
      (Reflect.getMetadata('exports', ChatModule) as unknown[]) ?? [];

    expect(exportsMetadata).toContain(ChatService);
  });
});
