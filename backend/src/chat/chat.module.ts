import { Module } from '@nestjs/common';
import { SafetyModule } from '../safety/safety.module';
import { LinkPreviewModule } from '../link-preview/link-preview.module';
import { CentrifugoService } from './centrifugo.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { SystemMessageService } from './services/system-message.service';

@Module({
  imports: [SafetyModule, LinkPreviewModule],
  controllers: [ChatController, GroupsController],
  providers: [
    CentrifugoService,
    ChatService,
    GroupsService,
    SystemMessageService,
  ],
  exports: [
    CentrifugoService,
    ChatService,
    GroupsService,
    SystemMessageService,
  ],
})
export class ChatModule {}
