import { Module } from '@nestjs/common';
import { ChatBackupController } from './chat-backup.controller';
import { ChatBackupService } from './chat-backup.service';

@Module({
  controllers: [ChatBackupController],
  providers: [ChatBackupService],
})
export class ChatBackupModule {}
