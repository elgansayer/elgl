import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SafetyModule } from '../safety/safety.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';
import { SpamDetectionModule } from '../spam-detection/spam-detection.module';
import { XpModule } from '../xp/xp.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { UsersModule } from '../users/users.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { CentrifugoService } from './centrifugo.service';
import { ReadReceiptsService } from './read-receipts.service';
import { TranslationService } from './translation.service';
import { ChatController } from './chat.controller';
import { ChatSearchController } from './chat-search.controller';
import { ChatService } from './chat.service';
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
import { DisappearingMessagesCleanupService } from './disappearing-messages-cleanup.service';
import { DisappearingMessagesInterceptor } from './disappearing-messages.interceptor';

@Module({
  imports: [
    SafetyModule,
    LinkPreviewModule,
    SpamDetectionModule,
    XpModule,
    LlmProxyModule,
    SupabaseModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [
    ChatController,
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
    ConversationStarterService,
    SystemMessageService,
    ChatSettingsService,
    ChatBackupService,
    QuickRepliesService,
    ChatSystemEventListener,
    DisappearingMessagesCleanupService,
    DisappearingMessagesInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: DisappearingMessagesInterceptor,
    },
  ],
  exports: [
    CentrifugoService,
    ReadReceiptsService,
    ChatLlmService,
    ChatLlmProxyService,
    ChatService,
    ConversationStarterService,
    SystemMessageService,
    ChatSettingsService,
  ],
})
export class ChatModule {}
