import { Module } from '@nestjs/common';
import { SafetyModule } from '../safety/safety.module';
import { CentrifugoService } from './centrifugo.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [SafetyModule],
  controllers: [ChatController],
  providers: [CentrifugoService, ChatService],
  exports: [CentrifugoService, ChatService],
})
export class ChatModule {}
