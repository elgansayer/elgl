import { Module } from '@nestjs/common';
import { AiConversationController } from './ai-conversation.controller';
import { AiConversationService } from './ai-conversation.service';

@Module({
  controllers: [AiConversationController],
  providers: [AiConversationService],
  exports: [AiConversationService],
})
export class AiConversationModule {}
