import { Module } from '@nestjs/common';
import { SystemMessageController } from './system-message.controller';
import { SystemMessageService } from './system-message.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [SystemMessageController],
  providers: [SystemMessageService],
  exports: [SystemMessageService],
})
export class SystemMessageModule {}
