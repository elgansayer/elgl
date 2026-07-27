import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { SystemMessagesService } from './system-messages.service';
import { SystemMessagesController } from './system-messages.controller';

@Module({
  imports: [ChatModule],
  providers: [SystemMessagesService],
  controllers: [SystemMessagesController],
  exports: [SystemMessagesService],
})
export class SystemMessagesModule {}
