import { Module } from '@nestjs/common';
import { AiConversationController } from './ai-conversation.controller';
import { AiConversationService } from './ai-conversation.service';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';
import { UsersModule } from '../users/users.module';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { StudyStreakModule } from '../study-streak/study-streak.module';
import { LearnerKnowledgeModule } from '../learner-knowledge/learner-knowledge.module';
import { DeveloperBotsModule } from '../developer-bots/developer-bots.module';

@Module({
  imports: [
    LlmProxyModule,
    UsersModule,
    FlashcardsModule,
    StudyStreakModule,
    LearnerKnowledgeModule,
    DeveloperBotsModule,
  ],
  controllers: [AiConversationController],
  providers: [AiConversationService],
  exports: [AiConversationService],
})
export class AiConversationModule {}
