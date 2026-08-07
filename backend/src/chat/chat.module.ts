import { Module } from '@nestjs/common';
import { SafetyModule } from '../safety/safety.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';
import { SpamDetectionModule } from '../spam-detection/spam-detection.module';
import { XpModule } from '../xp/xp.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
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
import { ChatBackupController } from './chat-backup.controller';
import { ChatBackupService } from './chat-backup.service';
import { QuickRepliesController } from './quick-replies/quick-replies.controller';
import { QuickRepliesService } from './quick-replies/quick-replies.service';

@Module({
  imports: [
    SafetyModule,
    LinkPreviewModule,
    SpamDetectionModule,
    XpModule,
    LlmProxyModule,
  ],
  controllers: [
    ChatController,
    ChatSettingsController,
    ChatBackupController,
    QuickRepliesController,
  ],
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
    ChatBackupService,
    QuickRepliesService,
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
