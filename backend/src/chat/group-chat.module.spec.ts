import { describe, expect, it } from 'vitest';
import { ChatModule } from './chat.module';
import { GroupChatController } from './group-chat.controller';
import { GroupChatService } from './group-chat.service';

describe('GroupChatModule wiring', () => {
  it('registers the group chat controller so /chat/groups routes are reachable', () => {
    const controllers = (Reflect.getMetadata('controllers', ChatModule) ??
      []) as unknown[];

    expect(controllers).toContain(GroupChatController);
  });

  it('provides and exports GroupChatService for the groups feature module', () => {
    const providers = (Reflect.getMetadata('providers', ChatModule) ??
      []) as unknown[];
    const exportsMetadata = (Reflect.getMetadata('exports', ChatModule) ??
      []) as unknown[];

    expect(providers).toContain(GroupChatService);
    expect(exportsMetadata).toContain(GroupChatService);
  });
});
