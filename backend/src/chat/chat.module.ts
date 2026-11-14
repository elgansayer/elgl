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
import { ChatArchiveController } from './chat-archive.controller';
import { ChatArchiveService } from './chat-archive.service';
import { ChatFoldersController } from './chat-folders.controller';
import { ChatFoldersService } from './chat-folders.service';
import { ChatMediaSendController } from './chat-media-send.controller';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatPinsController } from './chat-pins.controller';
import { ChatPinsService } from './chat-pins.service';
import { ChatTypingController } from './chat-typing.controller';
import { ChatTypingService } from './chat-typing.service';
import { MessageReactionsController } from './message-reactions.controller';
import { MessageReactionsService } from './message-reactions.service';
import { ChatController } from './chat.controller';
import { ChatEditController } from './chat-edit.controller';
import { ChatForwardController } from './chat-forward.controller';
import { ChatSearchController } from './chat-search.controller';
import { ChatService } from './chat.service';
import { SecureChatService } from './secure-chat.service';
import { ChatLlmService } from './chat-llm.service';
import { ChatLlmProxyService } from './chat-llm-proxy.service';
import { ConversationStarterService } from './conversation-starter.service';
import { DirectConversationController } from './direct-conversation.controller';
import { DirectConversationService } from './direct-conversation.service';
import { SystemMessageService } from './services/system-message.service';
import { ChatSettingsController } from './chat-settings.controller';
import { ChatSettingsService } from './chat-settings.service';
import { QuickRepliesController } from './quick-replies/quick-replies.controller';
import { QuickRepliesService } from './quick-replies/quick-replies.service';
import { ChatSystemEventListener } from './listeners/chat-system-event.listener';
import { DisappearingMessagesCleanupService } from './disappearing-messages-cleanup.service';
import { DisappearingMessagesInterceptor } from './disappearing-messages.interceptor';
import { PersonalUnreadListener } from './listeners/personal-unread.listener';
import { PersonalChatEncryptionService } from './personal-chat-encryption.service';
import { GroupChatController } from './group-chat.controller';
import { GroupChatService } from './group-chat.service';

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
    ChatEditController,
    ChatForwardController,
    ChatSearchController,
    DirectConversationController,
    ChatSettingsController,
    ChatArchiveController,
    ChatFoldersController,
    ChatMediaSendController,
    ChatPinsController,
    ChatTypingController,
    MessageReactionsController,
    QuickRepliesController,
    GroupChatController,
  ],
  providers: [
    CentrifugoService,
    GroupChatService,
    ReadReceiptsService,
    TranslationService,
    ChatLlmService,
    ChatLlmProxyService,
    { provide: ChatService, useClass: SecureChatService },
    ConversationStarterService,
    DirectConversationService,
    SystemMessageService,
    ChatSettingsService,
    ChatArchiveService,
    ChatFoldersService,
    ChatMediaMessageService,
    ChatPinsService,
    ChatTypingService,
    MessageReactionsService,
    QuickRepliesService,
    ChatSystemEventListener,
    DisappearingMessagesCleanupService,
    DisappearingMessagesInterceptor,
    PersonalUnreadListener,
    PersonalChatEncryptionService,
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
    DirectConversationService,
    SystemMessageService,
    ChatSettingsService,
    PersonalChatEncryptionService,
    GroupChatService,
  ],
})
export class ChatModule {}
