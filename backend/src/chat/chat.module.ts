import { Module } from '@nestjs/common';
import { SafetyModule } from '../safety/safety.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';
import { SpamDetectionModule } from '../spam-detection/spam-detection.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { CentrifugoService } from './centrifugo.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationStarterService } from './conversation-starter.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { SystemMessageService } from './services/system-message.service';
import { ChatSettingsController } from './chat-settings.controller';
import { ChatSettingsService } from './chat-settings.service';

@Module({
  imports: [
    SafetyModule,
    LinkPreviewModule,
    SpamDetectionModule,
    LlmProxyModule,
  ],
  controllers: [ChatController, GroupsController, ChatSettingsController],
  providers: [
    CentrifugoService,
    ChatService,
    ConversationStarterService,
    GroupsService,
    SystemMessageService,
    ChatSettingsService,
  ],
  exports: [
    CentrifugoService,
    ChatService,
    ConversationStarterService,
    GroupsService,
    SystemMessageService,
    ChatSettingsService,
  ],
})
export class ChatModule {}
