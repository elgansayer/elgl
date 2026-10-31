import { ChatModule } from './chat.module';
import { PersonalUnreadListener } from './listeners/personal-unread.listener';
import { ChatVoiceTranscriptionService } from './chat-voice-transcription.service';

describe('ChatModule', () => {
  it('registers the personal unread realtime listener', () => {
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(providers).toContain(PersonalUnreadListener);
  });

  it('registers the durable voice transcription worker', () => {
    const providers =
      (Reflect.getMetadata('providers', ChatModule) as unknown[]) ?? [];

    expect(providers).toContain(ChatVoiceTranscriptionService);
  });
});
