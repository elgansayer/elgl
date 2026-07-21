import { Module } from '@nestjs/common';
import { CentrifugoService } from './centrifugo.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [CentrifugoService, ChatService],
  exports: [CentrifugoService, ChatService],
})
export class ChatModule {}
