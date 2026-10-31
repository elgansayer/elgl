import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SafetyModule } from '../safety/safety.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';
import { SpamDetectionModule } from '../spam-detection/spam-detection.module';
import { XpModule } from '../xp/xp.module';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { UsersModule } from '../users/users.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { FavouritesModule } from '../favourites/favourites.module';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { LearnerKnowledgeModule } from '../learner-knowledge/learner-knowledge.module';
import { CentrifugoService } from './centrifugo.service';
import { ReadReceiptsService } from './read-receipts.service';
import { TranslationService } from './translation.service';
import { ChatController } from './chat.controller';
import { ChatE2eeController } from './chat-e2ee.controller';
import { ChatE2eeService } from './chat-e2ee.service';
import { ChatService } from './chat.service';
import { ChatLlmService } from './chat-llm.service';
import { ChatLlmProxyService } from './chat-llm-proxy.service';
import { ConversationStarterService } from './conversation-starter.service';
import { DirectConversationController } from './direct-conversation.controller';
import { DirectConversationService } from './direct-conversation.service';
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
    FavouritesModule,
    CloudflareR2Module,
    LearnerKnowledgeModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [
    ChatController,
    ChatE2eeController,
    DirectConversationController,
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
    ConversationStarterService,
    DirectConversationService,
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
    ChatE2eeService,
    ConversationStarterService,
    DirectConversationService,
    SystemMessageService,
    ChatSettingsService,
  ],
})
export class ChatModule {}
