import { Module, forwardRef } from '@nestjs/common';
import { SafetyModule } from '../safety/safety.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';
import { SpamDetectionModule } from '../spam-detection/spam-detection.module';
import { XpModule } from '../xp/xp.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { UsersModule } from '../users/users.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { CentrifugoService } from './centrifugo.service';
import { ReadReceiptsService } from './read-receipts.service';
import { TranslationService } from './translation.service';
import { ChatController } from './chat.controller';
import { ChatE2eeController } from './chat-e2ee.controller';
import { ChatMediaSendController } from './chat-media-send.controller';
import { ChatSearchController } from './chat-search.controller';
import { ChatService } from './chat.service';
import { ChatE2eeService } from './chat-e2ee.service';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatLlmService } from './chat-llm.service';
import { ChatLlmProxyService } from './chat-llm-proxy.service';
import { ConversationStarterService } from './conversation-starter.service';
import { SystemMessageService } from './services/system-message.service';
import { ChatSettingsController } from './chat-settings.controller';
import { ChatSettingsService } from './chat-settings.service';
import { ChatBackupController } from '../chat-backup/chat-backup.controller';
import { ChatBackupService } from '../chat-backup/chat-backup.service';
import { QuickRepliesController } from './quick-replies/quick-replies.controller';
import { QuickRepliesService } from './quick-replies/quick-replies.service';
import { ChatSystemEventListener } from './listeners/chat-system-event.listener';

@Module({
  imports: [
    SafetyModule,
    LinkPreviewModule,
    SpamDetectionModule,
    XpModule,
    LlmProxyModule,
    SupabaseModule,
    CloudflareR2Module,
    forwardRef(() => UsersModule),
  ],
  controllers: [
    ChatController,
    ChatE2eeController,
    ChatMediaSendController,
    ChatSearchController,
    ChatSettingsController,
    ChatBackupController,
    QuickRepliesController,
  ],
  providers: [
    CentrifugoService,
    ReadReceiptsService,
    TranslationService,
    ChatLlmService,
    ChatLlmProxyService,
    ChatService,
    ChatE2eeService,
    ChatMediaMessageService,
    ConversationStarterService,
    SystemMessageService,
    ChatSettingsService,
    ChatBackupService,
    QuickRepliesService,
    ChatSystemEventListener,
  ],
  exports: [
    CentrifugoService,
    ReadReceiptsService,
    ChatLlmService,
    ChatLlmProxyService,
    ChatService,
    ChatE2eeService,
    ConversationStarterService,
    SystemMessageService,
    ChatSettingsService,
  ],
})
export class ChatModule {}
