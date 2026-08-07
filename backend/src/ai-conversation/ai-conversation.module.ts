import { Module } from '@nestjs/common';
import { AiConversationController } from './ai-conversation.controller';
import { AiConversationService } from './ai-conversation.service';
import { LlmProxyModule } from '../llm-proxy/llm-proxy.module';

@Module({
  imports: [LlmProxyModule],
  controllers: [AiConversationController],
  providers: [AiConversationService],
  exports: [AiConversationService],
})
export class AiConversationModule {}
