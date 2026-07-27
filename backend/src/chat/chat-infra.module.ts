import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CentrifugoService } from './services/centrifugo.service';
import { SystemMessageService } from './services/system-message.service';

@Module({
  imports: [ConfigModule],
  providers: [CentrifugoService, SystemMessageService],
  exports: [CentrifugoService, SystemMessageService],
})
export class ChatInfraModule {}
