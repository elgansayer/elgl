import { Module } from '@nestjs/common';
import { SafetyModule } from '../safety/safety.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';
import { SpamDetectionModule } from '../spam-detection/spam-detection.module';
import { XpModule } from '../xp/xp.module';
import { CentrifugoService } from './centrifugo.service';
import { TranslationService } from './translation.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatLlmService } from './chat-llm.service';
import { ChatLlmProxyService } from './chat-llm-proxy.service';
import { ConversationStarterService } from './conversation-starter.service';
import { GroupsService } from './groups.service';
import { SystemMessageService } from './services/system-message.service';
import { ChatSettingsController } from './chat-settings.controller';
import { ChatSettingsService } from './chat-settings.service';

@Module({
  imports: [SafetyModule, LinkPreviewModule, SpamDetectionModule, XpModule],
  controllers: [ChatController, ChatSettingsController],
  providers: [
    CentrifugoService,
    TranslationService,
    ChatLlmService,
    ChatLlmProxyService,
    ChatService,
    ConversationStarterService,
    GroupsService,
    SystemMessageService,
    ChatSettingsService,
  ],
  exports: [
    CentrifugoService,
    ChatLlmService,
    ChatLlmProxyService,
    ChatService,
    ConversationStarterService,
    GroupsService,
    SystemMessageService,
    ChatSettingsService,
  ],
})
export class ChatModule {}
