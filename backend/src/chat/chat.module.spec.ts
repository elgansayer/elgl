import { ChatEditController } from './chat-edit.controller';
import { ChatModule } from './chat.module';

describe('ChatModule', () => {
  it('registers the authenticated message edit route', () => {
    const controllers =
      (Reflect.getMetadata('controllers', ChatModule) as unknown[]) ?? [];

    expect(controllers).toContain(ChatEditController);
  });
});
