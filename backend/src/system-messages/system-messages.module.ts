import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module'; // Exports CentrifugoService
import { SystemMessagesService } from './system-messages.service';

@Module({
  imports: [ChatModule],
  providers: [SystemMessagesService],
  exports: [SystemMessagesService],
})
export class SystemMessagesModule {}
