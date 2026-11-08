import { ChatModule } from './chat.module';
import { ChatSearchController } from './chat-search.controller';
import { PersonalUnreadListener } from './listeners/personal-unread.listener';
import { ChatVoiceTranscriptionService } from './chat-voice-transcription.service';

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

  it('registers the durable voice transcription worker', () => {
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(providers).toContain(ChatVoiceTranscriptionService);
  });
});
